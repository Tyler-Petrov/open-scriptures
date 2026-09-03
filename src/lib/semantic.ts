// On-device semantic verse search: a bundled int8 bge-small encoder embeds the
// query; 31,102 precomputed verse vectors (int8 + per-vector scale) are scored
// by brute-force dot product. Everything stays on the device.

import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { InferenceSession, Tensor } from "onnxruntime-react-native";
import { allVerseKeys, getChapter, ref as refLabel } from "@/lib/bible";
import { encodeWordPiece } from "@/lib/wordpiece";
import vocabJson from "../assets/semantic/vocab.json";
import meta from "../assets/semantic/meta.json";

export type SemanticHit = {
  verseKey: string;
  ref: string;
  text: string;
  score: number;
};

const vocab = vocabJson as unknown as Record<string, number>;

type State = {
  session: InferenceSession;
  keys: string[];
  count: number;
  dim: number;
  data: Int8Array;
  scales: Float32Array;
};

let state: State | null = null;
let initPromise: Promise<boolean> | null = null;

export function semanticAvailable(): boolean {
  return true;
}

async function assetBytes(moduleId: number): Promise<Uint8Array> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  const file = new File(uri);
  return await Promise.resolve(file.bytes());
}

async function init(): Promise<boolean> {
  try {
    const modelAsset = Asset.fromModule(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("../assets/semantic/bge-small-q.onnx")
    );
    await modelAsset.downloadAsync();
    const modelPath = (modelAsset.localUri ?? modelAsset.uri).replace("file://", "");
    const session = await InferenceSession.create(modelPath);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bytes = await assetBytes(require("../assets/semantic/verses.bin"));
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (dv.getUint32(0, false) !== 0x42564543) throw new Error("bad verse index");
    const count = dv.getUint32(4, true);
    const dim = dv.getUint32(8, true);
    const scales = new Float32Array(count);
    const data = new Int8Array(count * dim);
    let off = 12;
    for (let i = 0; i < count; i++) {
      scales[i] = dv.getFloat32(off, true);
      off += 4;
      data.set(new Int8Array(bytes.buffer, bytes.byteOffset + off, dim), i * dim);
      off += dim;
    }
    const keys = allVerseKeys();
    if (keys.length !== count) throw new Error(`index count ${count} != ${keys.length}`);
    state = { session, keys, count, dim, data, scales };
    return true;
  } catch (e) {
    console.warn("semantic search unavailable:", e);
    return false;
  }
}

async function embedQuery(query: string, s: State): Promise<Float32Array> {
  const ids = encodeWordPiece(meta.queryPrefix + query, vocab, 96);
  const n = ids.length;
  const feeds: Record<string, Tensor> = {
    input_ids: new Tensor("int64", BigInt64Array.from(ids, (x) => BigInt(x)), [1, n]),
    attention_mask: new Tensor(
      "int64",
      BigInt64Array.from({ length: n }, () => 1n),
      [1, n]
    ),
  };
  if ((meta.inputs as string[]).includes("token_type_ids")) {
    feeds.token_type_ids = new Tensor("int64", new BigInt64Array(n), [1, n]);
  }
  const out = await s.session.run(feeds);
  const hidden = out[meta.output].data as Float32Array; // [1, n, dim]; CLS = token 0
  const q = new Float32Array(s.dim);
  let norm = 0;
  for (let j = 0; j < s.dim; j++) {
    q[j] = hidden[j];
    norm += q[j] * q[j];
  }
  norm = Math.sqrt(norm) || 1;
  for (let j = 0; j < s.dim; j++) q[j] /= norm;
  return q;
}

export async function semanticSearch(query: string, k = 8): Promise<SemanticHit[]> {
  if (!state) {
    initPromise = initPromise ?? init();
    if (!(await initPromise)) return [];
  }
  const s = state as State;
  const q = await embedQuery(query, s);

  const scores = new Float32Array(s.count);
  const { data, scales, dim, count } = s;
  for (let i = 0; i < count; i++) {
    let acc = 0;
    const base = i * dim;
    for (let j = 0; j < dim; j++) acc += q[j] * data[base + j];
    scores[i] = acc / scales[i];
  }

  const top: number[] = [];
  for (let i = 0; i < count; i++) {
    if (top.length < k) {
      top.push(i);
      top.sort((a, b) => scores[a] - scores[b]);
    } else if (scores[i] > scores[top[0]]) {
      top[0] = i;
      top.sort((a, b) => scores[a] - scores[b]);
    }
  }
  top.sort((a, b) => scores[b] - scores[a]);

  const hits: SemanticHit[] = [];
  for (const i of top) {
    const key = s.keys[i];
    const [abbrev, ch, v] = key.split(".");
    const verses = await getChapter(abbrev, Number(ch));
    hits.push({
      verseKey: key,
      ref: refLabel(key),
      text: verses[Number(v) - 1] ?? "",
      score: scores[i],
    });
  }
  return hits;
}
