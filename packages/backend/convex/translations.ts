import { v } from "convex/values";
import { query } from "./_generated/server";
import { TRANSLATION_IDS, TRANSLATIONS } from "@openscripture/core";
import { assertClient } from "./lib/access";
import { availability } from "./lib/availability";

/** Every translation the app knows about, with whether this deployment can serve it. */
export const list = query({
  args: { clientKey: v.optional(v.string()) },
  returns: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      source: v.union(v.literal("bundled"), v.literal("apibible"), v.literal("esv")),
      available: v.boolean(),
      reason: v.optional(v.string()),
      offline: v.boolean(),
      cacheable: v.boolean(),
      kjvFeatures: v.boolean(),
      attribution: v.string(),
      shortAttribution: v.string(),
      blurb: v.string(),
    })
  ),
  handler: async (_ctx, args) => {
    assertClient(args.clientKey);
    return TRANSLATION_IDS.map((id) => {
      const t = TRANSLATIONS[id];
      const a = availability(t);
      return {
        id: t.id,
        name: t.name,
        source: t.source,
        available: a.available,
        reason: a.available ? undefined : a.reason,
        offline: t.offline,
        cacheable: t.cacheable,
        kjvFeatures: t.kjvFeatures,
        attribution: t.attribution,
        shortAttribution: t.shortAttribution,
        blurb: t.blurb,
      };
    });
  },
});
