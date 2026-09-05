#!/usr/bin/env python3
"""Build the server Strong's concordance data.

  python3 packages/backend/scripts/build-strongs.py

Sources (all public domain):
  kaiserlik/kjv            — KJV 1769 with inline [G####]/[H####] tags + lexicon
  openscriptures/strongs   — Strong's Hebrew & Greek dictionaries (JSON-in-JS)

Outputs into packages/backend/data/strongs/KJV/, with the shared dict.json one directory above:
  {BookName}.json  {"book":abbrev,"chapters":[[verse-spans|0,...],...]}
                   verse-spans = [[text, ["G123", ...]|0], ...] concat == source KJV verse
  dict.json        { code: {o,t,p,d,k,r,u,pos,l} }  (original, translit, pron,
                   def, kjv usage, derivation, outline, part-of-speech, language)
  occurrences.json { code: [verse ordinal in canonical order, ...] }
"""
import argparse, html, json, re, subprocess, sys, time, unicodedata
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO.parents[1] / "apps/mobile/scripts"))
from kjv_source import book_order, load_book

CACHE = Path.home() / ".cache" / "strongs-src"
OUT = REPO / "data" / "strongs" / "KJV"
RAW = "https://raw.githubusercontent.com/kaiserlik/kjv/master"
OS_HE = "https://raw.githubusercontent.com/openscriptures/strongs/master/hebrew/strongs-hebrew-dictionary.js"
OS_GR = "https://raw.githubusercontent.com/openscriptures/strongs/master/greek/strongs-greek-dictionary.js"

# ours -> kaiserlik file stem
MAP = {"Gen":"Gen","Exo":"Exo","Lev":"Lev","Num":"Num","Deu":"Deu","Jos":"Jos","Jdg":"Jdg","Rut":"Rth",
"1Sa":"1Sa","2Sa":"2Sa","1Ki":"1Ki","2Ki":"2Ki","1Ch":"1Ch","2Ch":"2Ch","Ezr":"Ezr","Neh":"Neh","Est":"Est",
"Job":"Job","Psa":"Psa","Pro":"Pro","Ecc":"Ecc","Sng":"Sng","Isa":"Isa","Jer":"Jer","Lam":"Lam","Ezk":"Eze",
"Dan":"Dan","Hos":"Hos","Jol":"Joe","Amo":"Amo","Oba":"Oba","Jon":"Jon","Mic":"Mic","Nam":"Nah","Hab":"Hab",
"Zep":"Zep","Hag":"Hag","Zec":"Zec","Mal":"Mal","Mat":"Mat","Mrk":"Mar","Luk":"Luk","Jhn":"Jhn","Act":"Act",
"Rom":"Rom","1Co":"1Co","2Co":"2Co","Gal":"Gal","Eph":"Eph","Php":"Phl","Col":"Col","1Th":"1Th","2Th":"2Th",
"1Ti":"1Ti","2Ti":"2Ti","Tit":"Tit","Phm":"Phm","Heb":"Heb","Jas":"Jas","1Pe":"1Pe","2Pe":"2Pe","1Jn":"1Jo",
"2Jn":"2Jo","3Jn":"3Jo","Jud":"Jde","Rev":"Rev"}


def log(*a):
    print(time.strftime("[%H:%M:%S]"), *a, flush=True)


def fetch(url, dest):
    if dest.exists() and dest.stat().st_size > 100:
        return dest
    subprocess.run(["curl", "-sL", "--retry", "4", "-o", str(dest), url], check=True)
    return dest


VERSE_RE = re.compile(r'"([0-9A-Za-z]+\|\d+\|\d+)"\s*:\s*\{\s*"en"\s*:\s*"((?:[^"\\]|\\.)*)"')


def extract_en(text):
    """Pull verse-key -> english text pairs without full-JSON parsing; some
    kaiserlik files have unescaped quotes in the non-English translations."""
    out = {}
    for m in VERSE_RE.finditer(text):
        out[m.group(1)] = json.loads('"' + m.group(2) + '"')
    return out


def norm(s):
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    s = unicodedata.normalize("NFC", s)
    return re.sub(r"\s+", " ", s).strip()


TAG = re.compile(r"\[([GH]\d+[a-zA-Z]?)\]")


ALNUM = re.compile(r"[A-Za-z0-9]")


def token_codes(tagged):
    """kaiserlik verse -> [(bare word, codes|0, italic 0|1)]. Tags glue to the
    word before them; <em> marks translator-supplied words."""
    text = tagged.replace("<em>", " \u27e8 ").replace("</em>", " \u27e9 ")
    tokens = []
    multi = 0
    ital = 0
    for raw in text.split():
        if raw == "\u27e8":
            ital += 1
            continue
        if raw == "\u27e9":
            ital = max(0, ital - 1)
            continue
        codes = list(dict.fromkeys(TAG.findall(raw)))
        word = TAG.sub("", raw)
        if not word:
            if codes and tokens:
                previous = tokens[-1][1] or []
                combined = list(dict.fromkeys(previous + codes))
                multi += max(0, len(combined) - max(1, len(previous)))
                tokens[-1] = (tokens[-1][0], combined, tokens[-1][2])
            continue
        if len(codes) > 1:
            multi += len(codes) - 1
        tokens.append((word, codes if codes else 0, 1 if ital else 0))
    # punctuation split off by the <em> markers re-attaches to a neighbor
    merged = []
    for tok in tokens:
        if not ALNUM.search(tok[0]):
            if merged:
                w, c, it = merged[-1]
                merged[-1] = (w + tok[0], c, it)
            else:
                merged.append(tok)
        elif len(merged) == 1 and not ALNUM.search(merged[0][0]):
            merged[0] = (merged[0][0] + tok[0], tok[1], tok[2])
        else:
            merged.append(tok)
    tokens = merged
    # A tag covers its whole preceding phrase (back to the previous tag), so
    # spread codes backward over untagged words: "burnt offerings[G3646]"
    # makes both words G3646. This follows this source's tagging convention;
    # it is not a claim of equivalence with BLB's reviewed alignments.
    carry = 0
    for i in range(len(tokens) - 1, -1, -1):
        w, c, it = tokens[i]
        if it:
            # Supplied English stays italic but has no original-language link.
            # Ignore even explicit tags here; they must not spread to neighbors.
            tokens[i] = (w, 0, it)
        elif c:
            carry = c
        elif carry:
            tokens[i] = (w, carry, it)
    return tokens, multi


def project_spans(verse, ktokens):
    """Map kaiserlik token codes/italics onto OUR verse text. Returns spans
    whose concatenation is byte-identical to `verse`, or None on mismatch.
    kaiserlik may truncate the verse tail; extra tokens stay untagged."""
    ours = verse.split()
    if len(ktokens) > len(ours):
        return None
    for (kw, _c, _it), ow in zip(ktokens, ours):
        if norm(kw).casefold() != norm(ow).casefold():
            return None
    spans = []

    def glue(t):
        if spans and len(spans[-1]) == 2 and spans[-1][1] == 0:
            spans[-1][0] += t
        else:
            spans.append([t, 0])

    def key(idx):
        if idx < len(ktokens):
            return (ktokens[idx][1], ktokens[idx][2])
        return (0, 0)

    n = len(ours)
    i = 0
    while i < n:
        code, ital = key(i)
        j = i
        while j < n and key(j) == (code, ital):
            j += 1
        phrase = " ".join(ours[i:j])
        if i > 0:
            glue(" ")
        if code:
            spans.append([phrase, code, 1] if ital else [phrase, code])
        elif ital:
            spans.append([phrase, 0, 1])
        else:
            glue(phrase)
        i = j
    return spans


def clean_kaiserlik(s):
    if not s:
        return ""
    s = re.sub(r"&#(\d+)-", lambda m: chr(int(m.group(1))), s)
    s = s.replace("&quot-", '"').replace("&amp-", "&").replace("&apos-", "'")
    return html.unescape(s).strip()


def main(alignments_only=False):
    CACHE.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    order = book_order()

    # ---------- verse spans ----------
    total = matched = tagged_words = multi_total = 0
    misses = []
    ordinal = 0
    occurrences = {}
    for abbr, fname in order:
        data = load_book(fname)
        kfile = fetch(f"{RAW}/{MAP[abbr]}.json", CACHE / f"{MAP[abbr]}.json")
        kverses = extract_en(kfile.read_text())
        chapters_out = []
        for ci, chap in enumerate(data["chapters"], 1):
            verses_out = []
            for vi, verse in enumerate(chap, 1):
                ordinal += 1
                total += 1
                en = kverses.get(f"{MAP[abbr]}|{ci}|{vi}")
                if not en:
                    verses_out.append(0)
                    misses.append(f"{abbr}.{ci}.{vi}:absent")
                    continue
                ktokens, multi = token_codes(en)
                multi_total += multi
                spans = project_spans(verse, ktokens)
                if spans is None:
                    verses_out.append(0)
                    misses.append(f"{abbr}.{ci}.{vi}:mismatch")
                    continue
                assert "".join(sp[0] for sp in spans) == verse
                matched += 1
                verses_out.append(spans)
                seen = set()
                for sp in spans:
                    c = sp[1]
                    if c:
                        tagged_words += 1
                        for code in c:
                            if code not in seen:
                                occurrences.setdefault(code, []).append(ordinal - 1)
                                seen.add(code)
            chapters_out.append(verses_out)
        (OUT / f"{fname}.json").write_text(
            json.dumps({"book": abbr, "chapters": chapters_out}, ensure_ascii=False, separators=(",", ":"))
        )
        log(f"{abbr}: spans written")
    log(f"verses matched {matched}/{total} ({100*matched/total:.2f}%), tagged words {tagged_words}, additional source tags retained {multi_total}")
    if misses:
        log("first misses:", misses[:8])
    (OUT / "occurrences.json").write_text(json.dumps(occurrences, separators=(",", ":")))
    log(f"occurrences.json: {len(occurrences)} entries, {(OUT/'occurrences.json').stat().st_size/1e6:.1f} MB")

    if alignments_only:
        return

    # ---------- dictionary ----------
    lex = json.loads((CACHE / "lexicon.json").read_text()) if (CACHE / "lexicon.json").exists() else {}
    dicts = {}
    for url, name in [(OS_HE, "he.js"), (OS_GR, "gr.js")]:
        raw = fetch(url, CACHE / name).read_text()
        raw = raw[raw.index("{") : raw.rindex("}") + 1]
        dicts.update(json.loads(raw))
    out = {}
    for code, e in dicts.items():
        deriv = e.get("derivation", "") or ""
        sdef = e.get("strongs_def", "") or ""
        lang = "Greek" if code.startswith("G") else ("Aramaic" if "Aramaic" in deriv + sdef else "Hebrew")
        x = lex.get(code, {})
        out[code] = {
            "o": e.get("lemma", ""),
            "t": e.get("translit") or e.get("xlit") or x.get("transliteration", ""),
            "p": e.get("pron", ""),
            "d": sdef.strip(" ;"),
            "k": (e.get("kjv_def", "") or "").strip(" ;"),
            "r": deriv.strip(),
            "u": clean_kaiserlik(x.get("outline_usage", "")),
            "pos": clean_kaiserlik(x.get("part_of_speech", "")),
            "l": lang,
        }
    (OUT.parent / "dict.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    log(f"dict.json: {len(out)} entries, {(OUT.parent/'dict.json').stat().st_size/1e6:.1f} MB")
    sizes = sum(f.stat().st_size for f in OUT.glob("*.json"))
    log(f"total assets: {sizes/1e6:.1f} MB")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--alignments-only", action="store_true", help="Preserve the existing shared dictionary")
    main(parser.parse_args().alignments_only)
