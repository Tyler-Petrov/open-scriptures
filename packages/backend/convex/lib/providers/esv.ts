import { bookByName, makeVerseKey, parseVerseKey, findBook, ref, type BookMeta } from "@openscripture/core";
import { tidy, upstream, type ProviderChapter, type ProviderHit } from "./types";

const BASE = "https://api.esv.org/v3/passage";

// Plain text, verse markers only. Nothing else is modified.
const TEXT_PARAMS = new URLSearchParams({
  "include-passage-references": "false",
  "include-verse-numbers": "true",
  "include-first-verse-numbers": "true",
  "include-footnotes": "false",
  "include-footnote-body": "false",
  "include-headings": "false",
  "include-short-copyright": "false",
  "include-copyright": "false",
  "include-selahs": "true",
  "indent-poetry": "false",
  "indent-paragraphs": "0",
  "indent-declares": "0",
  "indent-psalm-doxology": "0",
  "line-length": "0",
});

async function request(key: string, path: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Token ${key}`, accept: "application/json" },
    });
  } catch {
    throw upstream("upstream_error", "Couldn't reach Crossway's ESV service.");
  }
  if (res.status === 429) {
    throw upstream("rate_limited", "The ESV request limit was reached. Try again in a minute.");
  }
  if (!res.ok) {
    throw upstream("upstream_error", `Crossway's ESV service returned ${res.status}.`);
  }
  return res.json();
}

const MARKER = /\[(\d+)\]\s*/g;

/** Split "[1] In the beginning… [2] …" into verses; text before [1] is the intro. */
export function parsePassage(text: string): { verses: string[]; intro?: string } {
  const byVerse = new Map<number, string>();
  let intro = "";
  let last: number | null = null;
  let cursor = 0;
  for (const m of text.matchAll(MARKER)) {
    const chunk = text.slice(cursor, m.index);
    if (last == null) intro += chunk;
    else byVerse.set(last, (byVerse.get(last) ?? "") + chunk);
    last = Number(m[1]);
    cursor = m.index + m[0].length;
  }
  const tail = text.slice(cursor);
  if (last == null) intro += tail;
  else byVerse.set(last, (byVerse.get(last) ?? "") + tail);

  if (byVerse.size === 0) throw upstream("bad_response", "Crossway returned no verse text.");
  const max = Math.max(...byVerse.keys());
  const verses: string[] = [];
  for (let n = 1; n <= max; n++) verses.push(tidy(byVerse.get(n) ?? ""));
  const introText = tidy(intro);
  return introText ? { verses, intro: introText } : { verses };
}

export async function fetchChapter(key: string, book: BookMeta, chapter: number): Promise<ProviderChapter> {
  const q = encodeURIComponent(`${book.name} ${chapter}`);
  const json = await request(key, `/text/?q=${q}&${TEXT_PARAMS}`);
  const passage = Array.isArray(json?.passages) ? json.passages[0] : undefined;
  if (typeof passage !== "string") throw upstream("bad_response", "Crossway returned an empty chapter.");
  return parsePassage(passage);
}

/** One request for up to 50 verses: "John 3:16;Genesis 1:1". */
export async function fetchVerses(key: string, verseKeys: string[]): Promise<Record<string, string>> {
  const keys = verseKeys.filter((k) => findBook(parseVerseKey(k).abbrev)).slice(0, 50);
  if (keys.length === 0) return {};
  const q = encodeURIComponent(keys.map((k) => ref(k)).join(";"));
  const json = await request(key, `/text/?q=${q}&${TEXT_PARAMS}`);
  const passages: unknown[] = Array.isArray(json?.passages) ? json.passages : [];
  const meta: any[] = Array.isArray(json?.passage_meta) ? json.passage_meta : [];
  const out: Record<string, string> = {};
  passages.forEach((p, i) => {
    if (typeof p !== "string") return;
    const text = tidy(p.replace(MARKER, ""));
    // Match by position; fall back to the canonical reference when Crossway
    // dropped an unparseable query.
    let target = passages.length === keys.length ? keys[i] : undefined;
    if (!target) {
      const canonical = String(meta[i]?.canonical ?? "");
      const hit = parseReference(canonical);
      if (hit) target = keys.find((k) => k === hit);
    }
    if (target) out[target] = text;
  });
  return out;
}

function parseReference(label: string): string | null {
  const m = /^(.+?)\s+(\d+):(\d+)/.exec(label.trim());
  if (!m) return null;
  const book = bookByName(m[1]);
  if (!book) return null;
  return makeVerseKey(book.abbrev, Number(m[2]), Number(m[3]));
}

export async function search(key: string, q: string, limit: number): Promise<ProviderHit[]> {
  const params = new URLSearchParams({ q, "page-size": String(Math.min(Math.max(limit, 1), 100)) });
  const json = await request(key, `/search/?${params}`);
  const results: any[] = Array.isArray(json?.results) ? json.results : [];
  const hits: ProviderHit[] = [];
  for (const r of results) {
    const verseKey = parseReference(String(r?.reference ?? ""));
    if (!verseKey) continue;
    hits.push({ verseKey, ref: ref(verseKey), text: tidy(String(r?.content ?? "")) });
  }
  return hits;
}
