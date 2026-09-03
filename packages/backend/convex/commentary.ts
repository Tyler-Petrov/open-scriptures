import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import { findBook } from "@openscripture/core";
import { assertClient } from "./lib/access";

const MAX_WRITERS = 20;

const commentaryHit = v.object({
  writerId: v.string(),
  writer: v.string(),
  ref: v.string(),
  from: v.number(),
  to: v.number(),
  text: v.string(),
});

export type CommentaryHit = {
  writerId: string;
  writer: string;
  ref: string;
  from: number;
  to: number;
  text: string;
};

/** Commentary entries whose verse range contains the requested verse. */
export const forVerse = query({
  args: {
    book: v.string(),
    chapter: v.number(),
    verse: v.number(),
    clientKey: v.optional(v.string()),
  },
  returns: v.array(commentaryHit),
  handler: async (ctx, args): Promise<CommentaryHit[]> => {
    assertClient(args.clientKey);
    const book = findBook(args.book);
    if (
      !book ||
      !Number.isInteger(args.chapter) ||
      args.chapter < 1 ||
      args.chapter > book.chapters ||
      !Number.isInteger(args.verse) ||
      args.verse < 1
    ) {
      throw new ConvexError({ code: "bad_request", message: "Invalid verse reference." });
    }

    const chapters = await ctx.db
      .query("commentaryChapters")
      .withIndex("by_book_and_chapter_and_writerId", (q) =>
        q.eq("book", book.abbrev).eq("chapter", args.chapter)
      )
      .take(MAX_WRITERS);

    return chapters.flatMap((source) =>
      source.entries
        .filter((entry) => args.verse >= entry.from && args.verse <= entry.to)
        .map((entry) => ({
          writerId: source.writerId,
          writer: source.writer,
          ref: `${book.name} ${args.chapter}:${entry.from}${
            entry.to > entry.from ? `–${entry.to}` : ""
          }`,
          from: entry.from,
          to: entry.to,
          text: entry.text,
        }))
    );
  },
});
