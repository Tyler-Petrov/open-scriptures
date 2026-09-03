#!/usr/bin/env python3
"""Precompute KJV verse embeddings with the exact int8 ONNX model the app ships.

  uv run --with onnxruntime --with tokenizers --with numpy scripts/semantic/build-embeddings.py

Model: Xenova/bge-small-en-v1.5 onnx/model_quantized.onnx (384-dim, CLS pooling)
found at /tmp/bge/. Outputs into src/assets/semantic/:
  verses.bin   "BVEC" | u32 count | u32 dim | per-vector( f32 scale | int8[dim] )
  bge-small-q.onnx, vocab.json, meta.json   (runtime assets for the app)
"""
import json, re, struct, sys, time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

REPO = Path(__file__).resolve().parents[2]
SRC = Path("/tmp/bge")
OUT = REPO / "src" / "assets" / "semantic"
QUERY_PREFIX = "Represent this sentence for searching relevant passages: "


def book_order():
    src = (REPO / "src/lib/bible.ts").read_text()
    body = src.split("const FILES", 1)[1].split("};", 1)[0]
    return re.findall(r'"?([0-9A-Za-z]+)"?:\s*require\("\.\./assets/bible/([A-Za-z0-9]+)\.json"\)', body)


def load_verses():
    keys, texts = [], []
    for abbr, fname in book_order():
        data = json.loads((REPO / f"src/assets/bible/{fname}.json").read_text())
        for ci, chap in enumerate(data["chapters"], 1):
            for vi, verse in enumerate(chap, 1):
                keys.append(f"{abbr}.{ci}.{vi}")
                texts.append(verse)
    return keys, texts


def main():
    keys, texts = load_verses()
    print(f"{len(keys)} verses", flush=True)

    tok = Tokenizer.from_file(str(SRC / "tokenizer.json"))
    tok.enable_truncation(max_length=256)
    so = ort.SessionOptions()
    so.intra_op_num_threads = 8
    sess = ort.InferenceSession(str(SRC / "model_quantized.onnx"), so)
    in_names = [i.name for i in sess.get_inputs()]
    out_name = sess.get_outputs()[0].name
    print("model inputs:", in_names, "output:", out_name, flush=True)

    def embed(batch):
        encs = tok.encode_batch(batch)
        maxlen = max(len(e.ids) for e in encs)
        ids = np.zeros((len(encs), maxlen), dtype=np.int64)
        att = np.zeros((len(encs), maxlen), dtype=np.int64)
        for i, e in enumerate(encs):
            ids[i, : len(e.ids)] = e.ids
            att[i, : len(e.ids)] = e.attention_mask
        feeds = {"input_ids": ids, "attention_mask": att}
        if "token_type_ids" in in_names:
            feeds["token_type_ids"] = np.zeros_like(ids)
        (hidden,) = sess.run([out_name], feeds)
        cls = hidden[:, 0]
        return cls / np.linalg.norm(cls, axis=1, keepdims=True)

    t0 = time.time()
    chunks = []
    B = 128
    for i in range(0, len(texts), B):
        chunks.append(embed(texts[i : i + B]))
        if (i // B) % 20 == 0:
            done = i + B
            rate = done / max(1e-9, time.time() - t0)
            print(f"  {min(done,len(texts))}/{len(texts)} ({rate:.0f}/s)", flush=True)
    vecs = np.vstack(chunks).astype(np.float32)
    print(f"embedded in {time.time()-t0:.0f}s", flush=True)

    OUT.mkdir(parents=True, exist_ok=True)
    scales = 127.0 / np.maximum(np.abs(vecs).max(axis=1), 1e-6)
    q = np.clip(np.round(vecs * scales[:, None]), -127, 127).astype(np.int8)
    with open(OUT / "verses.bin", "wb") as f:
        f.write(b"BVEC")
        f.write(struct.pack("<II", vecs.shape[0], vecs.shape[1]))
        for i in range(vecs.shape[0]):
            f.write(struct.pack("<f", scales[i]))
            f.write(q[i].tobytes())
    print(f"wrote verses.bin ({(OUT/'verses.bin').stat().st_size/1e6:.1f} MB)", flush=True)

    deq = q.astype(np.float32) / scales[:, None]
    deq = deq / np.linalg.norm(deq, axis=1, keepdims=True)
    print(f"int8 fidelity: mean cos {(vecs*deq).sum(axis=1).mean():.5f}", flush=True)

    # runtime assets
    (OUT / "bge-small-q.onnx").write_bytes((SRC / "model_quantized.onnx").read_bytes())
    tj = json.loads((SRC / "tokenizer.json").read_text())
    vocab = tj["model"]["vocab"]
    (OUT / "vocab.json").write_text(json.dumps(vocab, separators=(",", ":")))
    (OUT / "meta.json").write_text(json.dumps({
        "dim": int(vecs.shape[1]),
        "count": int(vecs.shape[0]),
        "queryPrefix": QUERY_PREFIX,
        "inputs": in_names,
        "output": out_name,
        "lowercase": True,
    }))
    print("wrote model/vocab/meta assets", flush=True)

    # retrieval sanity eval
    queries = [
        "God's protection in hard times",
        "do not worry about tomorrow",
        "love your enemies",
        "the creation of the world",
        "salvation by faith not works",
        "children obey your parents",
        "the good shepherd",
        "money is the root of evil",
    ]
    qv = embed([QUERY_PREFIX + s for s in queries])
    sims = qv @ vecs.T
    for qi, query in enumerate(queries):
        top = np.argsort(-sims[qi])[:4]
        print(f"\nQ: {query}", flush=True)
        for t in top:
            print(f"   {sims[qi][t]:.3f} {keys[t]}: {texts[t][:90]}", flush=True)


if __name__ == "__main__":
    main()
