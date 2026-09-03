#!/usr/bin/env python3
"""Build per-reference commentary data from bible.helloao.org (public domain).

  python3 scripts/commentary/build-commentary.py

Entries are stored as [fromVerse, toVerse, text] per chapter; a verse-start
entry covers through the verse before the next entry (JFB's own sectioning),
and a chapter introduction becomes the entry for the leading verses.

Outputs src/assets/commentary/{writer}/{BookName}.json and regenerates
src/lib/commentary.ts loader maps.
"""
import json, re, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen

REPO = Path(__file__).resolve().parents[2]
CACHE = Path.home() / ".cache" / "commentary"
OUT = REPO / "src" / "assets" / "commentary"
API = "https://bible.helloao.org/api/c"

WRITERS = [
    ("jfb", "jamieson-fausset-brown", "Jamieson-Fausset-Brown"),
    ("henry", "matthew-henry", "Matthew Henry"),
    ("clarke", "adam-clarke", "Adam Clarke"),
]


def book_order():
    src = (REPO / "src/lib/bible.ts").read_text()
    body = src.split("const FILES", 1)[1].split("};", 1)[0]
    return re.findall(r'"?([0-9A-Za-z]+)"?:\s*require\("\.\./assets/bible/([A-Za-z0-9]+)\.json"\)', body)


def fetch(url, dest):
    if dest.exists():
        return dest.read_text()
    for attempt in range(4):
        try:
            with urlopen(url, timeout=30) as r:
                data = r.read().decode("utf-8")
            dest.write_text(data)
            return data
        except Exception:
            time.sleep(1 + attempt)
    return None


def clean(text):
    text = re.sub(r"\s*--\s*", " — ", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def build_writer(short, cid, order, verse_counts):
    wout = OUT / short
    wout.mkdir(parents=True, exist_ok=True)
    total = 0
    for abbr, fname in order:
        code = abbr.upper()
        nch = len(verse_counts[abbr])
        chapters = []
        for ci in range(1, nch + 1):
            dest = CACHE / cid / f"{code}-{ci}.json"
            dest.parent.mkdir(parents=True, exist_ok=True)
            raw = fetch(f"{API}/{cid}/{code}/{ci}.json", dest)
            entries = []
            if raw:
                try:
                    ch = json.loads(raw).get("chapter", {})
                except json.JSONDecodeError:
                    ch = {}
                nverses = verse_counts[abbr][ci - 1]
                verse_entries = []
                for e in ch.get("content", []):
                    if e.get("type") != "verse":
                        continue
                    parts = [p for p in e.get("content", []) if isinstance(p, str)]
                    if not parts:
                        continue
                    verse_entries.append((int(e["number"]), clean("\n\n".join(parts))))
                verse_entries.sort()
                intro = clean(ch.get("introduction") or "")
                # the intro echoes its own reference on the first line — drop it
                intro = re.sub(r"^[1-3]?\s?[A-Za-z ]+\d+:\d+\s*\n", "", intro).strip()
                starts = [v for v, _ in verse_entries]
                if intro and (not starts or starts[0] > 1):
                    end = (starts[0] - 1) if starts else nverses
                    entries.append([1, max(1, end), intro])
                for idx, (v, text) in enumerate(verse_entries):
                    end = (verse_entries[idx + 1][0] - 1) if idx + 1 < len(verse_entries) else nverses
                    entries.append([v, max(v, end), text])
            chapters.append(entries)
            total += len(entries)
        (wout / f"{fname}.json").write_text(
            json.dumps({"book": abbr, "chapters": chapters}, ensure_ascii=False, separators=(",", ":"))
        )
        print(f"  {short}/{abbr}: done", flush=True)
    size = sum(f.stat().st_size for f in wout.glob("*.json")) / 1e6
    print(f"{short}: {total} entries, {size:.1f} MB", flush=True)
    return size


def gen_loader_ts(order, writers):
    blocks = []
    for short, _cid, name in writers:
        loaders = ",\n".join(
            f'    {a if not a[0].isdigit() else chr(34)+a+chr(34)}: () => require("../assets/commentary/{short}/{f}.json")'
            for a, f in order
        )
        blocks.append(f'  {{\n    id: "{short}",\n    name: "{name}",\n    loaders: {{\n{loaders},\n    }},\n  }}')
    ts = f'''// Per-reference commentary (public domain, via bible.helloao.org), built by
// scripts/commentary/build-commentary.py. Entries are [from, to, text] per
// chapter; a verse resolves to the entry whose range contains it.

import {{ getBookMeta }} from "@/lib/bible";

type Entry = [number, number, string];
type CommentaryBook = {{ book: string; chapters: Entry[][] }};

export type CommentaryHit = {{
  writerId: string;
  writer: string;
  ref: string;
  from: number;
  to: number;
  text: string;
}};

type Writer = {{
  id: string;
  name: string;
  loaders: Record<string, () => CommentaryBook>;
}};

const WRITERS: Writer[] = [
{",\n".join(blocks)},
];

const cache = new Map<string, CommentaryBook>();

/** Every writer's entry covering this verse, in writer order. */
export function getCommentaryFor(
  abbrev: string,
  chapter: number,
  verse: number
): CommentaryHit[] {{
  const hits: CommentaryHit[] = [];
  let bookName = abbrev;
  try {{
    bookName = getBookMeta(abbrev).name;
  }} catch {{
    return hits;
  }}
  for (const w of WRITERS) {{
    const loader = w.loaders[abbrev];
    if (!loader) continue;
    const key = `${{w.id}}.${{abbrev}}`;
    let data = cache.get(key);
    if (!data) {{
      data = loader();
      cache.set(key, data);
    }}
    const entries = data.chapters[chapter - 1] ?? [];
    const entry = entries.find(([f, t]) => verse >= f && verse <= t);
    if (!entry) continue;
    const [f, t, text] = entry;
    hits.push({{
      writerId: w.id,
      writer: w.name,
      ref: `${{bookName}} ${{chapter}}:${{f}}${{t > f ? `–${{t}}` : ""}}`,
      from: f,
      to: t,
      text,
    }});
  }}
  return hits;
}}
'''
    (REPO / "src/lib/commentary.ts").write_text(ts)
    print("commentary.ts written", flush=True)


def main():
    order = book_order()
    verse_counts = {}
    for abbr, fname in order:
        data = json.loads((REPO / f"src/assets/bible/{fname}.json").read_text())
        verse_counts[abbr] = [len(ch) for ch in data["chapters"]]

    # warm the cache in parallel (all writers/chapters)
    jobs = []
    for _short, cid, _name in WRITERS:
        for abbr, _f in order:
            code = abbr.upper()
            for ci in range(1, len(verse_counts[abbr]) + 1):
                dest = CACHE / cid / f"{code}-{ci}.json"
                dest.parent.mkdir(parents=True, exist_ok=True)
                if not dest.exists():
                    jobs.append((f"{API}/{cid}/{code}/{ci}.json", dest))
    print(f"fetching {len(jobs)} chapter files…", flush=True)
    with ThreadPoolExecutor(max_workers=12) as ex:
        list(ex.map(lambda j: fetch(*j), jobs))
    print("fetch complete", flush=True)

    kept = []
    for short, cid, name in WRITERS:
        size = build_writer(short, cid, order, verse_counts)
        kept.append((short, cid, name, size))
    gen_loader_ts(order, [(s, c, n) for s, c, n, _ in kept])
    print("total:", f"{sum(s for *_r, s in kept):.1f} MB", flush=True)


if __name__ == "__main__":
    main()
