import { ConvexError, v } from "convex/values";
import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { TRANSLATIONS, getBookMeta, isTranslationId, isValidVerseKey, parseVerseKey } from "@openscripture/core";
import { assertClient } from "./lib/access";
import { apiBibleConfig, availability, esvKey, notConfigured } from "./lib/availability";
import * as apiBible from "./lib/providers/apiBible";
import * as esv from "./lib/providers/esv";

const MAX_KEYS = 100;
/** Bound on upstream API.Bible chapter fetches per lookup call. */
const MAX_UNCACHED_CHAPTERS = 10;

/**
 * Text for a handful of verse keys in the selected translation — used for
 * semantic-search hits (which are found against the KJV index) and library
 * snippets. Returns only the keys it could resolve.
 */
export const lookup = action({
  args: {
    translation: v.string(),
    keys: v.array(v.string()),
    clientKey: v.optional(v.string()),
  },
  returns: v.record(v.string(), v.string()),
  handler: async (ctx, args): Promise<Record<string, string>> => {
    assertClient(args.clientKey);
    if (!isTranslationId(args.translation)) {
      throw new ConvexError({ code: "bad_request", message: `Unknown translation ${args.translation}.` });
    }
    const t = TRANSLATIONS[args.translation];
    const a = availability(t);
    if (!a.available) throw new ConvexError({ code: "unavailable", message: a.reason });
    const keys = Array.from(new Set(args.keys.filter(isValidVerseKey))).slice(0, MAX_KEYS);
    if (keys.length === 0) return {};

    if (t.source === "bundled") {
      return await ctx.runQuery(internal.verses.bundledMany, { translation: t.id, keys });
    }

    if (t.source === "apibible") {
      const cfg = apiBibleConfig(t.id);
      if (!cfg) throw notConfigured(t);
      const byChapter = new Map<string, string[]>();
      for (const key of keys) {
        const { abbrev, chapter } = parseVerseKey(key);
        const ck = `${abbrev}.${chapter}`;
        byChapter.set(ck, [...(byChapter.get(ck) ?? []), key]);
      }
      const out: Record<string, string> = {};
      let fetched = 0;
      for (const [ck, verseKeys] of byChapter) {
        const [book, chapterRaw] = ck.split(".");
        const chapter = Number(chapterRaw);
        let verses: string[] | null = null;
        const cached = await ctx.runQuery(internal.chapters.readCache, { translation: t.id, book, chapter });
        if (cached) verses = cached.verses;
        else if (fetched < MAX_UNCACHED_CHAPTERS) {
          fetched++;
          const meta = getBookMeta(book);
          const got = await apiBible.fetchChapter(cfg, meta, chapter);
          await ctx.runMutation(internal.chapters.writeCache, {
            translation: t.id,
            book,
            chapter,
            verses: got.verses,
            intro: got.intro,
            copyright: got.copyright,
            fumsId: got.fumsId,
          });
          verses = got.verses;
        }
        if (!verses) continue;
        for (const key of verseKeys) {
          const text = verses[parseVerseKey(key).verse - 1];
          if (text) out[key] = text;
        }
      }
      return out;
    }

    const k = esvKey();
    if (!k) throw notConfigured(t);
    return await esv.fetchVerses(k, keys);
  },
});

export const bundledMany = internalQuery({
  args: { translation: v.string(), keys: v.array(v.string()) },
  returns: v.record(v.string(), v.string()),
  handler: async (ctx, args) => {
    const out: Record<string, string> = {};
    for (const key of args.keys.slice(0, MAX_KEYS)) {
      const { abbrev, chapter, verse } = parseVerseKey(key);
      const doc = await ctx.db
        .query("bundledVerses")
        .withIndex("by_ref", (q) =>
          q.eq("translation", args.translation).eq("book", abbrev).eq("chapter", chapter).eq("verse", verse)
        )
        .unique();
      if (doc) out[key] = doc.text;
    }
    return out;
  },
});
