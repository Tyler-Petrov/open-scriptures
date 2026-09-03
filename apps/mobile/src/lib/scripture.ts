// Scripture text in any translation, served through Convex.
//
// Everything goes through the backend today (including KJV, which is seeded
// from the bundled assets). The bundled KJV loader in `bible.ts` stays in the
// app for Strong's, audio timings and the semantic index, and is the natural
// place to add an offline provider later.

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@openscripture/backend/convex/_generated/api";
import type { TranslationId } from "@openscripture/core";
import { CLIENT_KEY, convex } from "@/lib/convex";

export type ChapterData = {
  verses: string[];
  /** Unnumbered text before verse 1 (e.g. a Psalm title). */
  intro?: string;
  /** Attribution required under the chapter for licensed translations. */
  copyright: string;
};

export type ChapterState =
  | { status: "loading" }
  | { status: "ready"; data: ChapterData; stale: boolean }
  | { status: "error"; message: string };

export type SearchHit = { verseKey: string; ref: string; text: string };

export type TranslationInfo = {
  id: string;
  name: string;
  source: "bundled" | "apibible" | "esv";
  available: boolean;
  reason?: string;
  offline: boolean;
  cacheable: boolean;
  kjvFeatures: boolean;
  attribution: string;
  shortAttribution: string;
  blurb: string;
};

/** Human-readable message for anything thrown by a Convex call. */
export function errorMessage(err: unknown): string {
  if (err instanceof ConvexError) {
    const d: unknown = err.data;
    if (d && typeof d === "object" && "message" in d) return String((d as { message: unknown }).message);
    if (typeof d === "string") return d;
  }
  if (err instanceof Error && err.message && !/^Server Error/i.test(err.message)) return err.message;
  return "Couldn't reach the server. Check your connection and try again.";
}

const inflight = new Map<string, Promise<ChapterData>>();

/** Fetch (and, for API.Bible text, cache server-side) one chapter. De-duplicates concurrent calls. */
export function loadChapter(
  translation: TranslationId,
  book: string,
  chapter: number,
  refresh = false
): Promise<ChapterData> {
  const key = `${translation}.${book}.${chapter}.${refresh ? "r" : "n"}`;
  const cur = inflight.get(key);
  if (cur) return cur;
  const p = convex
    .action(api.chapters.load, { translation, book, chapter, refresh, clientKey: CLIENT_KEY })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** One-shot chapter read for non-React code. Throws with a user-facing message. */
export async function getChapter(
  translation: TranslationId,
  book: string,
  chapter: number
): Promise<ChapterData> {
  const r = await convex.query(api.chapters.get, { translation, book, chapter, clientKey: CLIENT_KEY });
  if (r.status === "ready") return { verses: r.verses, intro: r.intro, copyright: r.copyright };
  if (r.status === "unavailable") throw new Error(r.reason);
  return loadChapter(translation, book, chapter);
}

type Fetched = { key: string; data?: ChapterData; error?: string };

/**
 * Reactive chapter text. Bundled and cached chapters arrive through the live
 * query; anything the backend reports as missing/passthrough/stale is loaded
 * through the action (ESV every time, API.Bible until it's cached).
 */
export function useChapter(
  translation: TranslationId,
  book: string,
  chapter: number
): { state: ChapterState; retry: () => void } {
  const key = `${translation}.${book}.${chapter}`;
  const live = useQuery(api.chapters.get, { translation, book, chapter, clientKey: CLIENT_KEY });
  const [fetched, setFetched] = useState<Fetched | null>(null);
  const [attempt, setAttempt] = useState(0);

  const needsLoad = live?.status === "missing" || live?.status === "passthrough";
  const stale = live?.status === "ready" && live.stale;

  useEffect(() => {
    if (!needsLoad && !stale) return;
    let alive = true;
    loadChapter(translation, book, chapter, stale).then(
      (data) => {
        if (alive && needsLoad) setFetched({ key, data });
      },
      (err) => {
        if (alive && needsLoad) setFetched({ key, error: errorMessage(err) });
      }
    );
    return () => {
      alive = false;
    };
  }, [key, translation, book, chapter, needsLoad, stale, attempt]);

  const retry = useCallback(() => {
    setFetched(null);
    setAttempt((n) => n + 1);
  }, []);

  let state: ChapterState;
  if (live === undefined) state = { status: "loading" };
  else if (live.status === "unavailable") state = { status: "error", message: live.reason };
  else if (live.status === "ready") {
    state = {
      status: "ready",
      data: { verses: live.verses, intro: live.intro, copyright: live.copyright },
      stale: live.stale,
    };
  } else if (fetched && fetched.key === key) {
    state = fetched.data
      ? { status: "ready", data: fetched.data, stale: false }
      : { status: "error", message: fetched.error ?? "Couldn't load this chapter." };
  } else state = { status: "loading" };

  return { state, retry };
}

/** Text for specific verse keys in a translation (semantic hits, library snippets). */
export function lookupVerses(
  translation: TranslationId,
  keys: string[]
): Promise<Record<string, string>> {
  if (keys.length === 0) return Promise.resolve({});
  return convex.action(api.verses.lookup, { translation, keys, clientKey: CLIENT_KEY });
}

/** Exact-word search through the translation's own provider. */
export function searchScripture(
  translation: TranslationId,
  q: string,
  limit = 40
): Promise<SearchHit[]> {
  return convex.action(api.search.exact, { translation, q, limit, clientKey: CLIENT_KEY });
}

/** Live list of translations and whether the backend can serve each one. */
export function useTranslations(): TranslationInfo[] | undefined {
  return useQuery(api.translations.list, { clientKey: CLIENT_KEY });
}
