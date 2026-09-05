import { v } from "convex/values";

export const translationId = v.union(v.literal("KJV"), v.literal("NASB"), v.literal("NIV"), v.literal("NKJV"), v.literal("ESV"));
export const entryValue = v.object({
  o: v.string(), t: v.string(), p: v.string(), d: v.string(), k: v.string(),
  r: v.string(), u: v.string(), pos: v.string(),
  l: v.union(v.literal("Hebrew"), v.literal("Greek"), v.literal("Aramaic")),
});
const sourceWord = v.object({
  id: v.string(), codes: v.array(v.string()),
  text: v.optional(v.string()), morphology: v.optional(v.string()),
});
const linkFields = {
  start: v.number(), end: v.number(), supplied: v.boolean(),
  sourceWordIds: v.optional(v.array(v.string())),
};
export const verseLinks = v.object({
  fingerprint: v.string(),
  sourceWords: v.optional(v.array(sourceWord)),
  // Existing deployments can continue serving their single-code rows while data is upgraded.
  links: v.array(v.union(
    v.object({ ...linkFields, codes: v.array(v.string()) }),
    v.object({ ...linkFields, code: v.union(v.string(), v.null()) }),
  )),
});
export const chapterLinks = v.array(v.union(verseLinks, v.null()));
