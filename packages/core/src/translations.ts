export type TranslationId = "KJV" | "NASB" | "NIV" | "ESV";

/**
 * Where the text comes from.
 * - bundled: public-domain text seeded into Convex from the app's assets
 *   (and still shipped inside the app for Strong's, audio timings and the
 *   future offline mode).
 * - apibible: fetched from API.Bible through Convex and cached per chapter.
 * - esv: fetched from Crossway's ESV API through Convex, never cached.
 */
export type TranslationSource = "bundled" | "apibible" | "esv";

export type Translation = {
  id: TranslationId;
  name: string;
  source: TranslationSource;
  /** The text may be served from a device-local copy in the future. */
  offline: boolean;
  /** The server may keep a shared per-chapter cache of this text. */
  cacheable: boolean;
  /** Strong's word study and LibriVox audio are aligned to KJV text only. */
  kjvFeatures: boolean;
  /** Full attribution shown under a chapter. */
  attribution: string;
  /** Short attribution appended to copied/shared text. */
  shortAttribution: string;
  /** One-line description for the translation picker. */
  blurb: string;
};

export const DEFAULT_TRANSLATION: TranslationId = "KJV";

export const TRANSLATION_IDS: TranslationId[] = ["KJV", "NASB", "NIV", "ESV"];

export const TRANSLATIONS: Record<TranslationId, Translation> = {
  KJV: {
    id: "KJV",
    name: "King James Version",
    source: "bundled",
    offline: true,
    cacheable: true,
    kjvFeatures: true,
    attribution: "King James Version. Public domain.",
    shortAttribution: "KJV",
    blurb: "1611 text. Word study and audio follow-along.",
  },
  NASB: {
    id: "NASB",
    name: "New American Standard Bible",
    source: "apibible",
    offline: false,
    cacheable: true,
    kjvFeatures: false,
    attribution:
      "Scripture quotations taken from the (NASB®) New American Standard Bible®, Copyright © 1960, 1971, 1977, 1995, 2020 by The Lockman Foundation. Used by permission. All rights reserved. lockman.org",
    shortAttribution: "NASB® © The Lockman Foundation",
    blurb: "Word-for-word. Served through API.Bible.",
  },
  NIV: {
    id: "NIV",
    name: "New International Version",
    source: "apibible",
    offline: false,
    cacheable: true,
    kjvFeatures: false,
    attribution:
      "Scripture quotations taken from The Holy Bible, New International Version® NIV® Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.™ Used by permission. All rights reserved worldwide.",
    shortAttribution: "NIV® © Biblica, Inc.",
    blurb: "Thought-for-thought. Served through API.Bible.",
  },
  ESV: {
    id: "ESV",
    name: "English Standard Version",
    source: "esv",
    offline: false,
    cacheable: false,
    kjvFeatures: false,
    attribution:
      "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.",
    shortAttribution: "ESV® © 2001 by Crossway",
    blurb: "Needs a connection. Fetched live from Crossway.",
  },
};

export function isTranslationId(value: unknown): value is TranslationId {
  return typeof value === "string" && (TRANSLATION_IDS as string[]).includes(value);
}

export function getTranslation(id: string): Translation {
  if (!isTranslationId(id)) throw new Error(`Unknown translation: ${id}`);
  return TRANSLATIONS[id];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** API.Bible: refresh cached copyrighted text within 14 days. */
export const CACHE_REFRESH_MS = 14 * DAY_MS;
/** API.Bible: cached copyrighted text must be gone after 30 days. */
export const CACHE_EXPIRE_MS = 30 * DAY_MS;
