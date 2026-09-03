import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import { findBook } from "@openscripture/core";
import { assertClient } from "./lib/access";

const chapterTiming = v.object({
  url: v.string(),
  start: v.number(),
  end: v.number(),
  verses: v.array(v.number()),
});

/** All chapter timings for one book, loaded when the reader enters that book. */
export const forBook = query({
  args: {
    book: v.string(),
    clientKey: v.optional(v.string()),
  },
  returns: v.union(
    v.null(),
    v.object({
      chapters: v.record(v.string(), chapterTiming),
    })
  ),
  handler: async (ctx, args) => {
    assertClient(args.clientKey);
    const book = findBook(args.book);
    if (!book) {
      throw new ConvexError({ code: "bad_request", message: `Unknown book ${args.book}.` });
    }
    const doc = await ctx.db
      .query("audioTimings")
      .withIndex("by_book", (q) => q.eq("book", book.abbrev))
      .unique();
    return doc ? { chapters: doc.chapters } : null;
  },
});
