import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  CACHE_EXPIRE_MS,
  CACHE_REFRESH_MS,
  TRANSLATIONS,
  findBook,
  isTranslationId,
  isValidChapter,
  type BookMeta,
  type Translation,
} from "@openscripture/core";
import { assertClient } from "./lib/access";
import { apiBibleConfig, availability, esvKey, notConfigured } from "./lib/availability";
import * as apiBible from "./lib/providers/apiBible";
import * as esv from "./lib/providers/esv";

export type ChapterPayload = {
  verses: string[];
  intro?: string;
  copyright: string;
};

const chapterArgs = {
  translation: v.string(),
  book: v.string(),
  chapter: v.number(),
  clientKey: v.optional(v.string()),
};

const chapterPayload = v.object({
  verses: v.array(v.string()),
  intro: v.optional(v.string()),
  copyright: v.string(),
});

function resolve(args: { translation: string; book: string; chapter: number; clientKey?: string }): {
  t: Translation;
  book: BookMeta;
} {
  assertClient(args.clientKey);
  if (!isTranslationId(args.translation)) {
    throw new ConvexError({ code: "bad_request", message: `Unknown translation ${args.translation}.` });
  }
  const book = findBook(args.book);
  if (!book || !isValidChapter(args.book, args.chapter)) {
    throw new ConvexError({ code: "bad_request", message: `No chapter ${args.book} ${args.chapter}.` });
  }
  return { t: TRANSLATIONS[args.translation], book };
}

/**
 * Reactive read. The client calls `load` when this says "missing" (API.Bible
 * text not cached yet, or cache expired), "passthrough" (ESV is never cached)
 * or "stale" (cached, but older than the 14-day refresh window).
 */
export const get = query({
  args: chapterArgs,
  returns: v.union(
    v.object({
      status: v.literal("ready"),
      verses: v.array(v.string()),
      intro: v.optional(v.string()),
      copyright: v.string(),
      stale: v.boolean(),
    }),
    v.object({ status: v.literal("missing") }),
    v.object({ status: v.literal("passthrough") }),
    v.object({ status: v.literal("unavailable"), reason: v.string() })
  ),
  handler: async (ctx, args) => {
    const { t, book } = resolve(args);
    const a = availability(t);
    if (!a.available) return { status: "unavailable" as const, reason: a.reason };

    if (t.source === "bundled") {
      const doc = await ctx.db
        .query("bundledChapters")
        .withIndex("by_ref", (q) =>
          q.eq("translation", t.id).eq("book", book.abbrev).eq("chapter", args.chapter)
        )
        .unique();
      if (!doc) {
        return {
          status: "unavailable" as const,
          reason: `${t.id} text hasn't been loaded on the server yet. Run the seed script.`,
        };
      }
      return { status: "ready" as const, verses: doc.verses, copyright: t.attribution, stale: false };
    }

    if (t.source === "apibible") {
      const doc = await ctx.db
        .query("chapterCache")
        .withIndex("by_ref", (q) =>
          q.eq("translation", t.id).eq("book", book.abbrev).eq("chapter", args.chapter)
        )
        .unique();
      const now = Date.now();
      if (!doc || doc.expiresAt <= now) return { status: "missing" as const };
      return {
        status: "ready" as const,
        verses: doc.verses,
        intro: doc.intro,
        copyright: doc.copyright ?? t.attribution,
        stale: now >= doc.refreshAfter,
      };
    }

    return { status: "passthrough" as const };
  },
});

/**
 * Non-reactive fetch that always ends with chapter text (or throws a
 * ConvexError the app shows verbatim — it never falls back to another
 * translation). API.Bible chapters are stored in the shared cache on the way
 * through; ESV chapters are returned without being stored anywhere.
 */
export const load = action({
  args: { ...chapterArgs, refresh: v.optional(v.boolean()) },
  returns: chapterPayload,
  handler: async (ctx, args): Promise<ChapterPayload> => {
    const { t, book } = resolve(args);
    const a = availability(t);
    if (!a.available) throw new ConvexError({ code: "unavailable", message: a.reason });
    const key = { translation: t.id, book: book.abbrev, chapter: args.chapter };

    if (t.source === "bundled") {
      const doc = await ctx.runQuery(internal.chapters.readBundled, key);
      if (!doc) {
        throw new ConvexError({
          code: "unavailable",
          message: `${t.id} text hasn't been loaded on the server yet. Run the seed script.`,
        });
      }
      return { verses: doc.verses, copyright: t.attribution };
    }

    if (t.source === "apibible") {
      const cached = await ctx.runQuery(internal.chapters.readCache, key);
      if (cached && !args.refresh) {
        return { verses: cached.verses, intro: cached.intro, copyright: cached.copyright ?? t.attribution };
      }
      const cfg = apiBibleConfig(t.id);
      if (!cfg) throw notConfigured(t);
      let fetched: apiBible.ProviderChapterResult;
      try {
        fetched = await apiBible.fetchChapter(cfg, book, args.chapter);
      } catch (err) {
        // A refresh that fails keeps serving the still-valid cached copy.
        if (cached) {
          return { verses: cached.verses, intro: cached.intro, copyright: cached.copyright ?? t.attribution };
        }
        throw err;
      }
      await ctx.runMutation(internal.chapters.writeCache, {
        ...key,
        verses: fetched.verses,
        intro: fetched.intro,
        copyright: fetched.copyright,
        fumsId: fetched.fumsId,
      });
      return { verses: fetched.verses, intro: fetched.intro, copyright: fetched.copyright ?? t.attribution };
    }

    const k = esvKey();
    if (!k) throw notConfigured(t);
    const fetched = await esv.fetchChapter(k, book, args.chapter);
    return { verses: fetched.verses, intro: fetched.intro, copyright: t.attribution };
  },
});

const refArgs = { translation: v.string(), book: v.string(), chapter: v.number() };

export const readBundled = internalQuery({
  args: refArgs,
  returns: v.union(v.null(), v.object({ verses: v.array(v.string()) })),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("bundledChapters")
      .withIndex("by_ref", (q) =>
        q.eq("translation", args.translation).eq("book", args.book).eq("chapter", args.chapter)
      )
      .unique();
    return doc ? { verses: doc.verses } : null;
  },
});

/** Cached chapter if it exists and hasn't passed its 30-day expiry. */
export const readCache = internalQuery({
  args: refArgs,
  returns: v.union(
    v.null(),
    v.object({
      verses: v.array(v.string()),
      intro: v.optional(v.string()),
      copyright: v.optional(v.string()),
      stale: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("chapterCache")
      .withIndex("by_ref", (q) =>
        q.eq("translation", args.translation).eq("book", args.book).eq("chapter", args.chapter)
      )
      .unique();
    const now = Date.now();
    if (!doc || doc.expiresAt <= now) return null;
    return { verses: doc.verses, intro: doc.intro, copyright: doc.copyright, stale: now >= doc.refreshAfter };
  },
});

export const writeCache = internalMutation({
  args: {
    ...refArgs,
    verses: v.array(v.string()),
    intro: v.optional(v.string()),
    copyright: v.optional(v.string()),
    fumsId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const fields = {
      verses: args.verses,
      intro: args.intro,
      copyright: args.copyright,
      fumsId: args.fumsId,
      fetchedAt: now,
      refreshAfter: now + CACHE_REFRESH_MS,
      expiresAt: now + CACHE_EXPIRE_MS,
    };
    const existing = await ctx.db
      .query("chapterCache")
      .withIndex("by_ref", (q) =>
        q.eq("translation", args.translation).eq("book", args.book).eq("chapter", args.chapter)
      )
      .unique();
    if (existing) await ctx.db.replace(existing._id, { ...fields, translation: args.translation, book: args.book, chapter: args.chapter });
    else await ctx.db.insert("chapterCache", { ...fields, translation: args.translation, book: args.book, chapter: args.chapter });
    return null;
  },
});

const PURGE_BATCH = 200;

/** Daily cron: drop cached chapters past their 30-day expiry. */
export const purgeExpired = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("chapterCache")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(PURGE_BATCH);
    for (const doc of expired) await ctx.db.delete(doc._id);
    if (expired.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.chapters.purgeExpired, {});
    }
    return null;
  },
});

/**
 * Remove every cached chapter of one translation. Run from the dashboard
 * (`npx convex run chapters:purgeTranslation '{"translation":"NIV"}'`) as
 * soon as API access or a translation licence ends.
 */
export const purgeTranslation = internalMutation({
  args: { translation: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("chapterCache")
      .withIndex("by_ref", (q) => q.eq("translation", args.translation))
      .take(PURGE_BATCH);
    for (const doc of docs) await ctx.db.delete(doc._id);
    if (docs.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.chapters.purgeTranslation, { translation: args.translation });
    }
    return null;
  },
});
