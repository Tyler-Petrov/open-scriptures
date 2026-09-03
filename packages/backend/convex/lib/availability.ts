import { ConvexError } from "convex/values";
import type { Translation, TranslationId } from "@openscripture/core";

export type ApiBibleConfig = { key: string; bibleId: string };

/** All API.Bible translations share one key. Bible ids come from the
 * API.Bible dashboard once each translation agreement is accepted. */
export function apiBibleConfig(id: TranslationId): ApiBibleConfig | null {
  const key = process.env.API_BIBLE_KEY;
  const bibleId = process.env[`API_BIBLE_${id}_ID`];
  if (!key || !bibleId) return null;
  return { key, bibleId };
}

export function esvKey(): string | null {
  return process.env.ESV_API_KEY || null;
}

export type Availability = { available: true } | { available: false; reason: string };

export function availability(t: Translation): Availability {
  switch (t.source) {
    case "bundled":
      return { available: true };
    case "apibible":
      return apiBibleConfig(t.id)
        ? { available: true }
        : {
            available: false,
            reason: `${t.id} isn't set up yet (API.Bible key or bible id missing on the server).`,
          };
    case "esv":
      return esvKey()
        ? { available: true }
        : { available: false, reason: "ESV isn't set up yet (Crossway API key missing on the server)." };
  }
}

/** Thrown when a provider's credentials vanished between the availability check and use. */
export function notConfigured(t: Translation): ConvexError<{ code: string; message: string }> {
  const a = availability(t);
  return new ConvexError({
    code: "unavailable",
    message: a.available ? `${t.id} isn't available right now.` : a.reason,
  });
}
