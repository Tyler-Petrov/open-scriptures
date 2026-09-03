#!/usr/bin/env python3
"""Align LibriVox KJV recordings to per-verse timestamps.

Run from the bible-app repo root:
  uv run --with faster-whisper scripts/audio-align/align.py --books Phm
  uv run --with faster-whisper scripts/audio-align/align.py            # everything

Pipeline per archive.org item: fetch file list -> download 64kb mp3s ->
faster-whisper word timestamps (cached) -> trigram-locate + difflib-align
each chunk against the item's KJV text -> per-verse start times ->
src/assets/timings/{abbrev}.json  ({"book","chapters":{n:{url,start,end,verses:[...]}}}).
"""
import argparse, difflib, json, os, re, subprocess, sys, time, unicodedata, urllib.request
from collections import Counter, defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CACHE = Path.home() / ".cache" / "bible-align"
OUT = REPO / "src" / "assets" / "timings"
ARCHIVE = "https://archive.org/download"

CHUNK = 800          # ASR words per alignment chunk
PAD = 250            # window padding (book words)
MIN_VOTES = 8        # trigram votes to accept a chunk location
MIN_RATIO = 0.35     # difflib ratio gate for a chunk
VERSE_MIN_WORDS = 2  # matched words needed for a direct verse anchor


def log(*a):
    print(time.strftime("[%H:%M:%S]"), *a, flush=True)


def norm_words(text):
    text = unicodedata.normalize("NFKD", text)
    out = []
    for raw in text.split():
        w = re.sub(r"[^a-z0-9]", "", raw.lower())
        if w and not w.isdigit():
            out.append(w)
    return out


def parse_audio_ts():
    src = (REPO / "src/lib/audio.ts").read_text()
    body = src.split("BOOK_AUDIO", 1)[1]
    pairs = re.findall(r'"?([0-9A-Za-z]+)"?:\s*`\$\{ITEM\}/([^/]+)/([^`]+)`', body)
    return {abbr: (item, fname) for abbr, item, fname in pairs}


def parse_book_order():
    src = (REPO / "src/lib/bible.ts").read_text()
    body = src.split("const FILES", 1)[1].split("};", 1)[0]
    pairs = re.findall(r'"?([0-9A-Za-z]+)"?:\s*require\("\.\./assets/bible/([A-Za-z0-9]+)\.json"\)', body)
    return [(abbr, fname) for abbr, fname in pairs]


def load_book(fname):
    return json.loads((REPO / f"src/assets/bible/{fname}.json").read_text())


def item_files(item):
    meta = CACHE / "meta" / f"{item}.json"
    meta.parent.mkdir(parents=True, exist_ok=True)
    if not meta.exists():
        with urllib.request.urlopen(f"https://archive.org/metadata/{item}", timeout=60) as r:
            meta.write_bytes(r.read())
    j = json.loads(meta.read_text())
    names = [f["name"] for f in j.get("files", []) if f["name"].endswith("_64kb.mp3")]

    def natkey(s):
        return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", s.lower())]

    return sorted(names, key=natkey)


def download(item, fname):
    dest = CACHE / "audio" / item / fname
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 10000:
        return dest
    url = f"{ARCHIVE}/{item}/{fname}"
    log("  downloading", fname)
    subprocess.run(
        ["curl", "-sL", "--retry", "4", "--retry-delay", "3", "-C", "-", "-o", str(dest), url],
        check=True,
    )
    return dest


_model = None
_device = "?"


def get_model(name):
    global _model, _device
    if _model is not None:
        return _model
    from faster_whisper import WhisperModel

    probe = CACHE / "probe.wav"
    if not probe.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi",
                        "-i", "sine=frequency=440:duration=1", str(probe)], check=True)
    try:
        _model = WhisperModel(name, device="cuda", compute_type="float16")
        list(_model.transcribe(str(probe))[0])  # force CUDA kernels to run now
        _device = "cuda"
    except Exception as e:
        log("  cuda unavailable (%s); using cpu int8" % type(e).__name__)
        _model = WhisperModel(name, device="cpu", compute_type="int8", cpu_threads=max(4, os.cpu_count() - 2))
        _device = "cpu"
    log("  whisper model ready on", _device)
    return _model


def transcribe(item, fname, model_name):
    tpath = CACHE / "transcripts" / item / (fname + ".json")
    tpath.parent.mkdir(parents=True, exist_ok=True)
    if tpath.exists():
        return json.loads(tpath.read_text())
    audio = download(item, fname)
    model = get_model(model_name)
    t0 = time.time()
    segments, info = model.transcribe(
        str(audio),
        language="en",
        beam_size=1,
        word_timestamps=True,
        condition_on_previous_text=False,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 700},
    )
    words = []
    for seg in segments:
        for w in seg.words or []:
            words.append([w.word.strip(), round(w.start, 2), round(w.end, 2)])
    data = {"duration": round(info.duration, 2), "words": words}
    tpath.write_text(json.dumps(data))
    log(f"  transcribed {fname}: {info.duration/60:.1f} min audio in {time.time()-t0:.0f}s ({len(words)} words)")
    return data


def build_item_text(books, order, book_cache):
    """-> list of (norm_word, abbrev, chapter, verse) in canonical order."""
    seq = []
    for abbr in [a for a, _ in order if a in books]:
        data = book_cache[abbr]
        for ci, chap in enumerate(data["chapters"], 1):
            for vi, verse in enumerate(chap, 1):
                for w in norm_words(verse):
                    seq.append((w, abbr, ci, vi))
    return seq


def align_file(asr, seq, tri_index):
    """asr: [[word, start, end],...]; -> matches: {(abbr,ch,vs): [times...]}, per-file match count."""
    awords = []
    for w, s, e in asr["words"]:
        for piece in norm_words(w):
            awords.append((piece, s))
    matches = defaultdict(list)
    total = 0
    seq_words = [t[0] for t in seq]
    for base in range(0, len(awords), CHUNK):
        chunk = awords[base : base + CHUNK]
        if len(chunk) < 20:
            continue
        votes = Counter()
        for i in range(len(chunk) - 2):
            tri = (chunk[i][0], chunk[i + 1][0], chunk[i + 2][0])
            for p in tri_index.get(tri, ()):
                votes[(p - i) // 25] += 1
        if not votes:
            continue
        bucket, nv = votes.most_common(1)[0]
        if nv < MIN_VOTES:
            continue
        wstart = max(0, bucket * 25 - PAD)
        wend = min(len(seq), bucket * 25 + len(chunk) + PAD)
        window = seq_words[wstart:wend]
        sm = difflib.SequenceMatcher(None, [w for w, _ in chunk], window, autojunk=False)
        blocks = sm.get_matching_blocks()
        matched_words = sum(b.size for b in blocks)
        if matched_words / max(1, len(chunk)) < MIN_RATIO:
            continue
        for b in blocks:
            for k in range(b.size):
                _, abbr, ch, vs = seq[wstart + b.b + k]
                matches[(abbr, ch, vs)].append(chunk[b.a + k][1])
                total += 1
    return matches, total


def process_item(item, books, order, book_cache, model_name):
    log(f"item {item} -> books {books}")
    files = item_files(item)
    if not files:
        log("  !! no 64kb mp3 files found"); return {}
    seq = build_item_text(books, order, book_cache)
    tri_index = defaultdict(list)
    seq_words = [t[0] for t in seq]
    for i in range(len(seq_words) - 2):
        tri_index[(seq_words[i], seq_words[i + 1], seq_words[i + 2])].append(i)

    # verse -> per file: (times, count); chapter -> per file count
    verse_times = {}  # (abbr,ch,vs) -> {fname: [times]}
    chap_counts = defaultdict(Counter)  # (abbr,ch) -> Counter(fname -> matched words)
    durations = {}
    for fname in files:
        asr = transcribe(item, fname, model_name)
        durations[fname] = asr["duration"]
        m, total = align_file(asr, seq, tri_index)
        log(f"  aligned {fname}: {total} matched words")
        for key, times in m.items():
            verse_times.setdefault(key, {})[fname] = times
            chap_counts[(key[0], key[1])][fname] += len(times)

    # words per verse for interpolation
    vwords = {}
    for abbr in books:
        data = book_cache[abbr]
        for ci, chap in enumerate(data["chapters"], 1):
            for vi, verse in enumerate(chap, 1):
                vwords[(abbr, ci, vi)] = max(1, len(norm_words(verse)))

    out = {}
    for abbr in books:
        data = book_cache[abbr]
        chapters = {}
        for ci, chap in enumerate(data["chapters"], 1):
            counter = chap_counts.get((abbr, ci))
            if not counter:
                continue
            fname, votes = counter.most_common(1)[0]
            nverses = len(chap)
            starts = [None] * nverses
            for vi in range(1, nverses + 1):
                times = sorted(verse_times.get((abbr, ci, vi), {}).get(fname, []))
                if len(times) >= min(VERSE_MIN_WORDS, vwords[(abbr, ci, vi)]):
                    starts[vi - 1] = times[0]
            direct = sum(1 for s in starts if s is not None)
            if direct / nverses < 0.5:
                log(f"  !! {abbr} {ci}: weak coverage {direct}/{nverses}, skipping chapter")
                continue
            # enforce monotonic, then interpolate gaps by verse word weight
            prev = -1.0
            for i in range(nverses):
                if starts[i] is not None:
                    if starts[i] <= prev:
                        starts[i] = None
                    else:
                        prev = starts[i]
            known = [i for i, s in enumerate(starts) if s is not None]
            rate = None
            if len(known) >= 2:
                span_words = sum(vwords[(abbr, ci, i + 1)] for i in range(known[0], known[-1]))
                rate = max(0.5, span_words / max(1.0, starts[known[-1]] - starts[known[0]]))
            rate = rate or 2.5  # words/sec fallback
            for i in range(nverses):
                if starts[i] is None:
                    lo = max([k for k in known if k < i], default=None)
                    hi = min([k for k in known if k > i], default=None)
                    if lo is not None:
                        w = sum(vwords[(abbr, ci, k + 1)] for k in range(lo, i))
                        starts[i] = starts[lo] + w / rate
                    elif hi is not None:
                        w = sum(vwords[(abbr, ci, k + 1)] for k in range(i, hi))
                        starts[i] = max(0.0, starts[hi] - w / rate)
            # strictly increasing
            for i in range(1, nverses):
                if starts[i] <= starts[i - 1]:
                    starts[i] = starts[i - 1] + 0.5
            end = starts[-1] + vwords[(abbr, ci, nverses)] / rate + 2.0
            end = min(end, durations.get(fname, end))
            chapters[str(ci)] = {
                "url": f"{ARCHIVE}/{item}/{fname}",
                "start": round(starts[0], 2),
                "end": round(end, 2),
                "verses": [round(s, 2) for s in starts],
                "direct": direct,
            }
        if chapters:
            out[abbr] = chapters
            done = len(chapters)
            log(f"  {abbr}: {done}/{len(data['chapters'])} chapters timed")
    # chapter end = next chapter start when same file & contiguous
    for abbr, chapters in out.items():
        for ci_str, ch in chapters.items():
            nxt = chapters.get(str(int(ci_str) + 1))
            if nxt and nxt["url"] == ch["url"] and nxt["start"] > ch["start"]:
                ch["end"] = nxt["start"]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--books", help="comma-separated abbrevs (default: all)")
    ap.add_argument("--model", default="small.en")
    args = ap.parse_args()

    order = parse_book_order()
    audio_map = parse_audio_ts()
    book_cache = {abbr: load_book(fname) for abbr, fname in order}

    targets = args.books.split(",") if args.books else [a for a, _ in order]
    items = defaultdict(list)
    for abbr, _ in order:
        if abbr in audio_map:
            items[audio_map[abbr][0]].append(abbr)
    todo = {item: books for item, books in items.items() if any(b in targets for b in books)}

    OUT.mkdir(parents=True, exist_ok=True)
    for item, books in todo.items():
        try:
            result = process_item(item, books, order, book_cache, args.model)
        except Exception as e:
            log(f"!! item {item} failed: {e!r}")
            continue
        for abbr, chapters in result.items():
            name = dict(order)[abbr]
            path = OUT / f"{name}.json"
            path.write_text(json.dumps({"book": abbr, "chapters": chapters}))
            log(f"wrote {path.name}")
    log("all done")


if __name__ == "__main__":
    main()
