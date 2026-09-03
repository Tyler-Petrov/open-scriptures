import { bookByApiBibleId, makeVerseKey, ref, type BookMeta } from "@openscripture/core";
import type { ApiBibleConfig } from "../availability";
import { tidy, upstream, type ProviderChapter, type ProviderHit } from "./types";

const BASE = "https://api.scripture.api.bible/v1";

async function request(cfg: ApiBibleConfig, path: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "api-key": cfg.key, accept: "application/json" },
    });
  } catch {
    throw upstream("upstream_error", "Couldn't reach API.Bible.");
  }
  if (res.status === 429) {
    throw upstream("rate_limited", "API.Bible's monthly request limit has been reached.");
  }
  if (!res.ok) {
    throw upstream("upstream_error", `API.Bible returned ${res.status}.`);
  }
  return res.json();
}

type ContentItem =
  | { type: "text"; text: string; attrs?: { verseId?: string } }
  | { type: "tag"; name: string; attrs?: Record<string, string>; items?: ContentItem[] };

function verseNumber(verseId: string): number | null {
  // "GEN.1.5" — bridged verses arrive as "GEN.1.5-GEN.1.6"; use the first.
  const first = verseId.split("-")[0];
  const n = Number(first.split(".").pop());
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Turn API.Bible's `content-type=json` tree into one string per verse. */
export function parseChapterContent(content: unknown): { verses: string[]; intro?: string } {
  const byVerse = new Map<number, string[]>();
  const intro: string[] = [];
  let paragraphBreak = false;

  const walk = (items: ContentItem[] | undefined) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      if (item.type === "text") {
        const text = String(item.text ?? "");
        const id = item.attrs?.verseId;
        const n = id ? verseNumber(id) : null;
        if (n == null) {
          if (byVerse.size === 0 && text.trim()) intro.push(text);
          continue;
        }
        const parts = byVerse.get(n) ?? [];
        if (paragraphBreak && parts.length > 0) parts.push(" ");
        parts.push(text);
        byVerse.set(n, parts);
        paragraphBreak = false;
      } else if (item.type === "tag") {
        // Verse-number labels and footnotes aren't scripture text.
        if (item.name === "verse" || item.name === "note") continue;
        if (item.name === "para") paragraphBreak = true;
        walk(item.items);
      }
    }
  };
  walk(content as ContentItem[]);

  if (byVerse.size === 0) throw upstream("bad_response", "API.Bible returned no verse text.");
  const max = Math.max(...byVerse.keys());
  const verses: string[] = [];
  for (let n = 1; n <= max; n++) verses.push(tidy((byVerse.get(n) ?? []).join("")));
  const introText = tidy(intro.join(" "));
  return introText ? { verses, intro: introText } : { verses };
}

export async function fetchChapter(
  cfg: ApiBibleConfig,
  book: BookMeta,
  chapter: number
): Promise<ProviderChapter> {
  const params = new URLSearchParams({
    "content-type": "json",
    "include-notes": "false",
    "include-titles": "false",
    "include-chapter-numbers": "false",
    "include-verse-numbers": "false",
    "include-verse-spans": "false",
  });
  const json = await request(
    cfg,
    `/bibles/${cfg.bibleId}/chapters/${book.apiBibleId}.${chapter}?${params}`
  );
  const data = json?.data;
  if (!data) throw upstream("bad_response", "API.Bible returned an empty chapter.");
  const parsed = parseChapterContent(data.content);
  return {
    ...parsed,
    copyright: typeof data.copyright === "string" ? tidy(data.copyright) : undefined,
    fumsId: typeof json?.meta?.fumsId === "string" ? json.meta.fumsId : undefined,
  };
}

export async function search(cfg: ApiBibleConfig, q: string, limit: number): Promise<ProviderHit[]> {
  const params = new URLSearchParams({
    query: q,
    limit: String(Math.min(Math.max(limit, 1), 100)),
    sort: "canonical",
  });
  const json = await request(cfg, `/bibles/${cfg.bibleId}/search?${params}`);
  const verses: any[] = Array.isArray(json?.data?.verses) ? json.data.verses : [];
  const hits: ProviderHit[] = [];
  for (const item of verses) {
    const [bookId, ch, vs] = String(item?.id ?? "").split(".");
    const book = bookByApiBibleId(bookId ?? "");
    const chapter = Number(ch);
    const verse = Number(vs);
    if (!book || !Number.isInteger(chapter) || !Number.isInteger(verse)) continue;
    const verseKey = makeVerseKey(book.abbrev, chapter, verse);
    hits.push({ verseKey, ref: ref(verseKey), text: tidy(String(item?.text ?? "")) });
  }
  return hits;
}

export type ProviderChapterResult = ProviderChapter;
