// On-device Strong's concordance: per-verse word spans tagged with Strong's
// numbers, the merged dictionary, and an occurrence index. All data is built
// by scripts/strongs/build-strongs.py and bundled — nothing loads from network.

import { allVerseKeys } from "@openscripture/core";

/** [surface text, Strong's code or 0 for untagged glue, 1 when the word was
 * supplied by the translators (rendered italic, as in printed KJVs)] */
export type WordSpan = [string, string | 0] | [string, string | 0, number];

export type StrongsEntry = {
  o: string; // original word
  t: string; // transliteration
  p: string; // pronunciation (when known)
  d: string; // Strong's definition
  k: string; // how the KJV translates it
  r: string; // derivation
  u: string; // outline of usage
  pos: string; // part of speech
  l: "Hebrew" | "Greek" | "Aramaic";
};

type SpanBook = { book: string; chapters: (WordSpan[] | 0)[][] };

const SPAN_LOADERS: Record<string, () => SpanBook> = {
  Gen: () => require("../assets/strongs/Genesis.json"),
  Exo: () => require("../assets/strongs/Exodus.json"),
  Lev: () => require("../assets/strongs/Leviticus.json"),
  Num: () => require("../assets/strongs/Numbers.json"),
  Deu: () => require("../assets/strongs/Deuteronomy.json"),
  Jos: () => require("../assets/strongs/Joshua.json"),
  Jdg: () => require("../assets/strongs/Judges.json"),
  Rut: () => require("../assets/strongs/Ruth.json"),
  "1Sa": () => require("../assets/strongs/1Samuel.json"),
  "2Sa": () => require("../assets/strongs/2Samuel.json"),
  "1Ki": () => require("../assets/strongs/1Kings.json"),
  "2Ki": () => require("../assets/strongs/2Kings.json"),
  "1Ch": () => require("../assets/strongs/1Chronicles.json"),
  "2Ch": () => require("../assets/strongs/2Chronicles.json"),
  Ezr: () => require("../assets/strongs/Ezra.json"),
  Neh: () => require("../assets/strongs/Nehemiah.json"),
  Est: () => require("../assets/strongs/Esther.json"),
  Job: () => require("../assets/strongs/Job.json"),
  Psa: () => require("../assets/strongs/Psalms.json"),
  Pro: () => require("../assets/strongs/Proverbs.json"),
  Ecc: () => require("../assets/strongs/Ecclesiastes.json"),
  Sng: () => require("../assets/strongs/SongofSolomon.json"),
  Isa: () => require("../assets/strongs/Isaiah.json"),
  Jer: () => require("../assets/strongs/Jeremiah.json"),
  Lam: () => require("../assets/strongs/Lamentations.json"),
  Ezk: () => require("../assets/strongs/Ezekiel.json"),
  Dan: () => require("../assets/strongs/Daniel.json"),
  Hos: () => require("../assets/strongs/Hosea.json"),
  Jol: () => require("../assets/strongs/Joel.json"),
  Amo: () => require("../assets/strongs/Amos.json"),
  Oba: () => require("../assets/strongs/Obadiah.json"),
  Jon: () => require("../assets/strongs/Jonah.json"),
  Mic: () => require("../assets/strongs/Micah.json"),
  Nam: () => require("../assets/strongs/Nahum.json"),
  Hab: () => require("../assets/strongs/Habakkuk.json"),
  Zep: () => require("../assets/strongs/Zephaniah.json"),
  Hag: () => require("../assets/strongs/Haggai.json"),
  Zec: () => require("../assets/strongs/Zechariah.json"),
  Mal: () => require("../assets/strongs/Malachi.json"),
  Mat: () => require("../assets/strongs/Matthew.json"),
  Mrk: () => require("../assets/strongs/Mark.json"),
  Luk: () => require("../assets/strongs/Luke.json"),
  Jhn: () => require("../assets/strongs/John.json"),
  Act: () => require("../assets/strongs/Acts.json"),
  Rom: () => require("../assets/strongs/Romans.json"),
  "1Co": () => require("../assets/strongs/1Corinthians.json"),
  "2Co": () => require("../assets/strongs/2Corinthians.json"),
  Gal: () => require("../assets/strongs/Galatians.json"),
  Eph: () => require("../assets/strongs/Ephesians.json"),
  Php: () => require("../assets/strongs/Philippians.json"),
  Col: () => require("../assets/strongs/Colossians.json"),
  "1Th": () => require("../assets/strongs/1Thessalonians.json"),
  "2Th": () => require("../assets/strongs/2Thessalonians.json"),
  "1Ti": () => require("../assets/strongs/1Timothy.json"),
  "2Ti": () => require("../assets/strongs/2Timothy.json"),
  Tit: () => require("../assets/strongs/Titus.json"),
  Phm: () => require("../assets/strongs/Philemon.json"),
  Heb: () => require("../assets/strongs/Hebrews.json"),
  Jas: () => require("../assets/strongs/James.json"),
  "1Pe": () => require("../assets/strongs/1Peter.json"),
  "2Pe": () => require("../assets/strongs/2Peter.json"),
  "1Jn": () => require("../assets/strongs/1John.json"),
  "2Jn": () => require("../assets/strongs/2John.json"),
  "3Jn": () => require("../assets/strongs/3John.json"),
  Jud: () => require("../assets/strongs/Jude.json"),
  Rev: () => require("../assets/strongs/Revelation.json"),
};

const spanCache = new Map<string, SpanBook>();

export function getVerseSpans(
  abbrev: string,
  chapter: number,
  verse: number
): WordSpan[] | null {
  const loader = SPAN_LOADERS[abbrev];
  if (!loader) return null;
  let data = spanCache.get(abbrev);
  if (!data) {
    data = loader();
    spanCache.set(abbrev, data);
  }
  const spans = data.chapters[chapter - 1]?.[verse - 1];
  return Array.isArray(spans) && spans.length > 0 ? spans : null;
}

let dict: Record<string, StrongsEntry> | null = null;

export function getEntry(code: string): StrongsEntry | null {
  if (!dict) {
    dict = require("../assets/strongs/dict.json") as Record<string, StrongsEntry>;
  }
  return dict[code] ?? null;
}

let occ: Record<string, number[]> | null = null;
let keys: string[] | null = null;

/** verseKeys where this Strong's number appears, in canonical order. */
export function getOccurrences(code: string): string[] {
  if (!occ) {
    occ = require("../assets/strongs/occurrences.json") as Record<string, number[]>;
  }
  if (!keys) keys = allVerseKeys();
  return (occ[code] ?? []).map((i) => keys![i]).filter(Boolean);
}
