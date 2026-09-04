import { v } from "convex/values";

export const translationId = v.union(v.literal("KJV"), v.literal("NASB"), v.literal("NIV"), v.literal("NKJV"), v.literal("ESV"));
export const entryValue = v.object({
  o: v.string(), t: v.string(), p: v.string(), d: v.string(), k: v.string(),
  r: v.string(), u: v.string(), pos: v.string(),
  l: v.union(v.literal("Hebrew"), v.literal("Greek"), v.literal("Aramaic")),
});
export const verseLinks = v.object({
  fingerprint: v.string(),
  links: v.array(v.object({
    start: v.number(), end: v.number(), code: v.union(v.string(), v.null()), supplied: v.boolean(),
  })),
});
export const chapterLinks = v.array(v.union(verseLinks, v.null()));
