import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Public-domain text seeded from the app's bundled assets (KJV today).
  // Immutable; replaced wholesale by `npm run seed`.
  bundledChapters: defineTable({
    translation: v.string(),
    book: v.string(),
    chapter: v.number(),
    verses: v.array(v.string()),
  }).index("by_ref", ["translation", "book", "chapter"]),

  // One row per verse of a bundled translation, for full-text search.
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

  // Shared server-side cache of copyrighted chapters fetched from API.Bible
  // (NASB, NIV). Refreshed after 14 days, purged after 30. ESV is never
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
