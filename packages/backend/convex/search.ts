import { ConvexError, v } from "convex/values";
import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { BOOKS, TRANSLATIONS, isTranslationId, makeVerseKey, ref } from "@openscripture/core";
import { assertClient } from "./lib/access";
import { apiBibleConfig, availability, esvKey, notConfigured } from "./lib/availability";
import * as apiBible from "./lib/providers/apiBible";
import * as esv from "./lib/providers/esv";

const hit = v.object({ verseKey: v.string(), ref: v.string(), text: v.string() });
export type SearchHit = { verseKey: string; ref: string; text: string };

const MAX_LIMIT = 200;

/**
 * Exact-word search in the selected translation's own provider: the Convex
 * search index for bundled text, API.Bible's search for NASB/NIV/NKJV, Crossway's
 * search for ESV.
 */
export const exact = action({
  args: {
    translation: v.string(),
    q: v.string(),
    limit: v.optional(v.number()),
    clientKey: v.optional(v.string()),
  },
  returns: v.array(hit),
  handler: async (ctx, args): Promise<SearchHit[]> => {
    assertClient(args.clientKey);
    if (!isTranslationId(args.translation)) {
      throw new ConvexError({ code: "bad_request", message: `Unknown translation ${args.translation}.` });
    }
    const t = TRANSLATIONS[args.translation];
    const a = availability(t);
    if (!a.available) throw new ConvexError({ code: "unavailable", message: a.reason });
    const q = args.q.trim();
    if (!q) return [];
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(args.limit ?? 40)));

    if (t.source === "bundled") {
      return await ctx.runQuery(internal.search.bundled, { translation: t.id, q, limit });
    }
    if (t.source === "apibible") {
      const cfg = apiBibleConfig(t.id);
      if (!cfg) throw notConfigured(t);
      return await apiBible.search(cfg, q, limit);
    }
    const k = esvKey();
    if (!k) throw notConfigured(t);
    return await esv.search(k, q, limit);
  },
});

const BOOK_ORDER = new Map(BOOKS.map((b, i) => [b.abbrev, i]));

/**
 * Full-text search over bundled verses, post-filtered so every typed word
 * must appear (case-insensitive substring, like the original on-device
 * search), returned in canonical order.
 */
export const bundled = internalQuery({
  args: { translation: v.string(), q: v.string(), limit: v.number() },
  returns: v.array(hit),
  handler: async (ctx, args) => {
    const terms = args.q.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];
    const docs = await ctx.db
      .query("bundledVerses")
      .withSearchIndex("by_text", (s) => s.search("text", args.q).eq("translation", args.translation))
      .take(1024);
    const matched = docs.filter((d) => {
      const lower = d.text.toLowerCase();
      return terms.every((term) => lower.includes(term));
    });
    matched.sort(
      (x, y) =>
        (BOOK_ORDER.get(x.book) ?? 0) - (BOOK_ORDER.get(y.book) ?? 0) ||
        x.chapter - y.chapter ||
        x.verse - y.verse
    );
    return matched.slice(0, args.limit).map((d) => {
      const verseKey = makeVerseKey(d.book, d.chapter, d.verse);
      return { verseKey, ref: ref(verseKey), text: d.text };
    });
  },
});
