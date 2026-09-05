import { ConvexError, v } from "convex/values";
import { findBook } from "@openscripture/core";
import { internalQuery, query } from "./_generated/server";
import { assertClient } from "./lib/access";
import { chapterLinks, entryValue, translationId } from "./lib/strongs";

function checkCode(code: string) {
  if (!/^[GH][1-9][0-9]{0,4}[a-zA-Z]?$/.test(code)) {
    throw new ConvexError({ code: "bad_request", message: "Invalid Strong's number." });
  }
}

export const chapter = query({
  args: { translation: translationId, book: v.string(), chapter: v.number(), clientKey: v.optional(v.string()) },
  returns: v.union(v.object({ source: v.string(), verses: chapterLinks }), v.null()),
  handler: async (ctx, args) => {
    assertClient(args.clientKey);
    const book = findBook(args.book);
    if (!book || !Number.isInteger(args.chapter) || args.chapter < 1 || args.chapter > book.chapters) {
      throw new ConvexError({ code: "bad_request", message: "Invalid chapter reference." });
    }
    const row = await ctx.db.query("strongsChapters")
      .withIndex("by_translation_and_book_and_chapter", q =>
        q.eq("translation", args.translation).eq("book", book.abbrev).eq("chapter", args.chapter)).unique();
    return row ? { source: row.source, verses: row.verses } : null;
  },
});

export const entry = query({
  args: { code: v.string(), clientKey: v.optional(v.string()) },
  returns: v.union(entryValue, v.null()),
  handler: async (ctx, args) => {
    assertClient(args.clientKey);
    checkCode(args.code);
    const row = await ctx.db.query("strongsEntries").withIndex("by_code", q => q.eq("code", args.code)).unique();
    return row?.entry ?? null;
  },
});

export const occurrences = query({
  args: { translation: translationId, code: v.string(), clientKey: v.optional(v.string()) },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    assertClient(args.clientKey);
    checkCode(args.code);
    const row = await ctx.db.query("strongsOccurrences")
      .withIndex("by_translation_and_code", q => q.eq("translation", args.translation).eq("code", args.code)).unique();
    return row?.keys ?? [];
  },
});

/** Administrative preflight for the append-only seed script. */
export const importStatus = internalQuery({
  args: { translation: translationId },
  returns: v.object({ dictionary: v.boolean(), chapters: v.boolean(), occurrences: v.boolean() }),
  handler: async (ctx, { translation }) => ({
    dictionary: (await ctx.db.query("strongsEntries").first()) !== null,
    chapters: (await ctx.db.query("strongsChapters").withIndex("by_translation_and_book_and_chapter", q => q.eq("translation", translation)).first()) !== null,
    occurrences: (await ctx.db.query("strongsOccurrences").withIndex("by_translation_and_code", q => q.eq("translation", translation)).first()) !== null,
  }),
});
