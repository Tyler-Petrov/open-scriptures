#!/usr/bin/env python3
"""Build David Guzik (Enduring Word) commentary into per-reference storage.

Sections are the NUMBERED headings ("### 2. (1-2) Title"); each section's verse
range comes from the scripture block it quotes (data-ref="GEN-1-3-5"), not from
the heading. Sections without a scripture ref are ranged by gpt-5.6-luna
(via `opencode run`) against the chapter's verse count. Group headings ("A.")
and intros fold into the following section. Quoted scripture is excluded.

Output: src/assets/commentary/guzik/{BookName}.json
        {"book": abbrev, "v": 3, "chapters": [[[from, to, text], ...], ...]}
Enduring Word is © David Guzik (free for personal use; personal app only).
"""
import html as H
import json, re, subprocess, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen

REPO = Path(__file__).resolve().parents[2]
CACHE = Path.home() / ".cache" / "guzik"
OUT = REPO / "src" / "assets" / "commentary" / "guzik"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
MODEL = "openai/gpt-5.6-luna"
NUM_HEAD = re.compile(r"^###\s*\d+[a-cA-C]?\.")
MARKER = re.compile(r"\[VERSE ([A-Z0-9]+)-(\d+)-(\d+)(?:-(\d+))?\]")


def log(*a):
    print(time.strftime("[%H:%M:%S]"), *a, flush=True)


def book_order():
    src = (REPO / "src/lib/bible.ts").read_text()
    body = src.split("const FILES", 1)[1].split("};", 1)[0]
    return re.findall(r'"?([0-9A-Za-z]+)"?:\s*require\("\.\./assets/bible/([A-Za-z0-9]+)\.json"\)', body)


def slug_for(name):
    s = re.sub(r"([a-z])([A-Z0-9])", r"\1-\2", name)
    s = s.replace("1", "1-").replace("2", "2-").replace("3", "3-") if s[0].isdigit() else s
    s = re.sub(r"-+", "-", s).lower()
    if s == "psalms":
        s = "psalm"
    if s in ("songof-solomon", "songofsolomon"):
        s = "song-of-solomon"
    return s


def fetch(url, dest):
    if dest.exists() and dest.stat().st_size > 5000:
        return True
    for attempt in range(4):
        try:
            with urlopen(Request(url, headers={"User-Agent": UA}), timeout=40) as r:
                data = r.read()
            if len(data) > 5000:
                dest.write_bytes(data)
                return True
        except Exception:
            time.sleep(1 + attempt * 2)
    return False


def extract(htm):
    start = htm.find('id="section-')
    if start > 0:
        h = htm.rfind("<h3", 0, start)
        start = h if h > 0 else 0
    else:
        start = 0
    end = htm.find('class="ew-author-info', start)
    if end < 0:
        end = htm.find("<footer", start)
    seg = htm[start : end if end > 0 else len(htm)]
    seg = re.sub(
        r'<p class="ew-bible-text" data-ref="([A-Z0-9]+-\d+-\d+(?:-\d+)?)"[^>]*>.*?</p>',
        r"\n[VERSE \1]\n", seg, flags=re.S)
    seg = re.sub(r"<strong[^>]*>", "**", seg)
    seg = re.sub(r"</strong>", "**", seg)
    seg = re.sub(r"<em[^>]*>", "*", seg)
    seg = re.sub(r"</em>", "*", seg)
    seg = re.sub(r"<h[34][^>]*>", "\n### ", seg)
    seg = re.sub(r"</h[34]>", "\n", seg)
    seg = re.sub(r"<br[^>]*>", "\n", seg)
    seg = re.sub(r"<script[\s\S]*?</script>", " ", seg)
    seg = re.sub(r"<style[\s\S]*?</style>", " ", seg)
    seg = re.sub(r"<[^>]+>", " ", seg)
    seg = H.unescape(seg)
    seg = re.sub(r"[ \t]+", " ", seg)
    seg = re.sub(r"\n{3,}", "\n\n", seg)
    return seg.strip()


def clean_body(body):
    body = MARKER.sub("", body)
    body = re.sub(r"[ \t]+", " ", body)
    body = re.sub(r"\n{3,}", "\n\n", body)
    return body.strip()


def title_of(head):
    return re.sub(r"^###\s*(\d+[a-cA-C]?\.\s*)?(\([^)]*\)\s*)?", "", head).strip()


def parse_chapter(text, chapter):
    """-> (sections, luna_asks)
    sections: [{heading,title,body,range|None}] for numbered headings, with
    unranged intro/group material folded forward via 'pending'."""
    heads = [ln.strip() for ln in text.split("\n") if ln.strip().startswith("### ")]
    pos, cursor = [], 0
    for h in heads:
        i = text.find(h, cursor)
        if i < 0:
            i = text.find(h)
        pos.append(i)
        if i >= 0:
            cursor = i + len(h)
    slices = []
    for idx in range(len(heads)):
        if pos[idx] < 0:
            slices.append("")
            continue
        endpos = len(text)
        for j in range(idx + 1, len(heads)):
            if pos[j] > pos[idx]:
                endpos = pos[j]
                break
        slices.append(text[pos[idx] + len(heads[idx]):endpos])
    sections = []
    pending = ""
    for h, sl in zip(heads, slices):
        if not NUM_HEAD.match(h):
            block = (title_of(h) + "\n\n" + clean_body(sl)).strip()
            pending = (pending + "\n\n" + block).strip()
            continue
        rng = None
        vs = []
        for m in MARKER.finditer(sl):
            if int(m.group(2)) == chapter:
                f = int(m.group(3))
                t = int(m.group(4)) if m.group(4) else f
                vs += [f, t]
        if vs:
            rng = [min(vs), max(vs)]
        body = clean_body(sl)
        full = (title_of(h) + ("\n\n" + pending if pending else "") + ("\n\n" + body if body else "")).strip()
        pending = ""
        sections.append({"heading": h, "text": full, "range": rng})
    asks = [i for i, s in enumerate(sections) if s["range"] is None]
    return sections, asks


def luna_ranges(book_name, requests):
    """requests: [(key, heading, excerpt, chapter, nverses)] -> {key: [f,t]|None}"""
    if not requests:
        return {}
    payload = [
        {"key": k, "chapter": c, "verseCount": n, "heading": h, "start": ex}
        for k, h, ex, c, n in requests
    ]
    prompt = (
        f"These are commentary sections from David Guzik's study of {book_name} that lack an explicit "
        "scripture reference. From each heading and opening text, determine which verse range of its "
        "chapter the section covers. Respond ONLY with JSON (no fences): an object mapping each key to "
        "[from,to] (integers within 1..verseCount) or null when the section is general/preface material "
        "not tied to specific verses.\n\n" + json.dumps(payload, ensure_ascii=False)
    )
    try:
        r = subprocess.run(["opencode", "run", prompt, "-m", MODEL],
                           capture_output=True, text=True, timeout=600, cwd="/tmp")
        m = re.search(r"\{[\s\S]*\}", r.stdout)
        if not m:
            return {}
        parsed = json.loads(m.group(0))
        out = {}
        for k, _h, _e, _c, n in requests:
            v = parsed.get(k)
            if isinstance(v, list) and len(v) == 2 and all(isinstance(x, int) for x in v) and 1 <= v[0] <= v[1]:
                out[k] = [v[0], min(v[1], n)]
            else:
                out[k] = None
        return out
    except Exception as e:
        log("  luna failed:", repr(e)[:100])
        return {}


def main():
    order = book_order()
    verse_counts, names = {}, {}
    for abbr, fname in order:
        data = json.loads((REPO / f"src/assets/bible/{fname}.json").read_text())
        verse_counts[abbr] = [len(ch) for ch in data["chapters"]]
        names[abbr] = data["name"]

    CACHE.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    jobs = []
    for abbr, fname in order:
        slug = slug_for(names[abbr].replace(" ", ""))
        for ci in range(1, len(verse_counts[abbr]) + 1):
            dest = CACHE / f"{abbr}-{ci}.html"
            if not dest.exists():
                jobs.append((f"https://enduringword.com/bible-commentary/{slug}-{ci}/", dest))
    if jobs:
        log(f"fetching {len(jobs)} chapter pages…")
        with ThreadPoolExecutor(max_workers=6) as ex:
            results = list(ex.map(lambda j: fetch(*j), jobs))
        log(f"fetch complete, {sum(1 for r in results if not r)} failures")

    grand = luna_used = 0
    for abbr, fname in order:
        outp = OUT / f"{fname}.json"
        try:
            if json.loads(outp.read_text()).get("v") == 3:
                continue
        except Exception:
            pass
        nch = len(verse_counts[abbr])
        per_ch = {}
        asks = []
        for ci in range(1, nch + 1):
            p = CACHE / f"{abbr}-{ci}.html"
            if not p.exists():
                per_ch[ci] = []
                continue
            sections, need = parse_chapter(extract(p.read_text(encoding="utf-8", errors="replace")), ci)
            per_ch[ci] = sections
            for i in need:
                s = sections[i]
                asks.append((f"{ci}:{i}", s["heading"], s["text"][:350], ci, verse_counts[abbr][ci - 1]))
        # luna for the rare unranged sections, in batches of 20
        for b in range(0, len(asks), 20):
            got = luna_ranges(names[abbr], asks[b:b + 20])
            luna_used += len(got)
            for key, rng in got.items():
                ci, i = key.split(":")
                per_ch[int(ci)][int(i)]["range"] = rng
        chapters = []
        total = 0
        for ci in range(1, nch + 1):
            n = verse_counts[abbr][ci - 1]
            ent = []
            for s in per_ch.get(ci, []):
                if not s["range"]:
                    continue
                f, t = s["range"]
                if f < 1 or f > n:
                    continue
                ent.append([f, min(t, n), s["text"]])
            ent.sort(key=lambda e: (e[0], e[1]))
            chapters.append(ent)
            total += len(ent)
        outp.write_text(json.dumps({"book": abbr, "v": 3, "chapters": chapters},
                                   ensure_ascii=False, separators=(",", ":")))
        grand += total
        log(f"{abbr}: {total} entries")
    size = sum(f.stat().st_size for f in OUT.glob("*.json")) / 1e6
    log(f"all done: {grand} entries, luna-ranged {luna_used}, {size:.1f} MB")


if __name__ == "__main__":
    main()
