import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Public-domain text stored permanently in Convex (KJV today).
  bundledChapters: defineTable({
    translation: v.string(),
    book: v.string(),
    chapter: v.number(),
    verses: v.array(v.string()),
  }).index("by_ref", ["translation", "book", "chapter"]),

  // One row per verse of a Convex-hosted public-domain translation, for full-text search.
  bundledVerses: defineTable({
    translation: v.string(),
    book: v.string(),
    chapter: v.number(),
    verse: v.number(),
    text: v.string(),
  })
    .index("by_ref", ["translation", "book", "chapter", "verse"])
    .searchIndex("by_text", {
      searchField: "text",
      filterFields: ["translation"],
    }),

  // Commentary stored one chapter per document. Chapter-sized
  // documents keep every row below Convex's 1 MiB document limit.
  commentaryChapters: defineTable({
    writerId: v.string(),
    writer: v.string(),
    book: v.string(),
    chapter: v.number(),
    entries: v.array(
      v.object({
        from: v.number(),
        to: v.number(),
        text: v.string(),
      })
    ),
  }).index("by_book_and_chapter_and_writerId", ["book", "chapter", "writerId"]),

  // LibriVox chapter and verse offsets stored one document per book.
  audioTimings: defineTable({
    book: v.string(),
    chapters: v.record(
      v.string(),
      v.object({
        url: v.string(),
        start: v.number(),
        end: v.number(),
        verses: v.array(v.number()),
      })
    ),
  }).index("by_book", ["book"]),

  // Shared server-side cache of copyrighted chapters fetched from API.Bible
  // (NASB, NIV, NKJV). Refreshed after 14 days, purged after 30. ESV is never
  // written here.
  chapterCache: defineTable({
    translation: v.string(),
    book: v.string(),
    chapter: v.number(),
    verses: v.array(v.string()),
    intro: v.optional(v.string()),
    copyright: v.optional(v.string()),
    fumsId: v.optional(v.string()),
    fetchedAt: v.number(),
    refreshAfter: v.number(),
    expiresAt: v.number(),
  })
    .index("by_ref", ["translation", "book", "chapter"])
    .index("by_expiresAt", ["expiresAt"]),
});
