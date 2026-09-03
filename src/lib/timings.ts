// Per-verse audio timings produced by scripts/audio-align/align.py.
// Books not yet aligned ship an empty {"chapters": {}} skeleton.

export type ChapterTiming = {
  url: string;
  start: number;
  end: number;
  verses: number[];
};

type BookTimings = { book: string; chapters: Record<string, ChapterTiming> };

const FILES: Record<string, BookTimings> = {
  Gen: require("../assets/timings/Genesis.json"),
  Exo: require("../assets/timings/Exodus.json"),
  Lev: require("../assets/timings/Leviticus.json"),
  Num: require("../assets/timings/Numbers.json"),
  Deu: require("../assets/timings/Deuteronomy.json"),
  Jos: require("../assets/timings/Joshua.json"),
  Jdg: require("../assets/timings/Judges.json"),
  Rut: require("../assets/timings/Ruth.json"),
  "1Sa": require("../assets/timings/1Samuel.json"),
  "2Sa": require("../assets/timings/2Samuel.json"),
  "1Ki": require("../assets/timings/1Kings.json"),
  "2Ki": require("../assets/timings/2Kings.json"),
  "1Ch": require("../assets/timings/1Chronicles.json"),
  "2Ch": require("../assets/timings/2Chronicles.json"),
  Ezr: require("../assets/timings/Ezra.json"),
  Neh: require("../assets/timings/Nehemiah.json"),
  Est: require("../assets/timings/Esther.json"),
  Job: require("../assets/timings/Job.json"),
  Psa: require("../assets/timings/Psalms.json"),
  Pro: require("../assets/timings/Proverbs.json"),
  Ecc: require("../assets/timings/Ecclesiastes.json"),
  Sng: require("../assets/timings/SongofSolomon.json"),
  Isa: require("../assets/timings/Isaiah.json"),
  Jer: require("../assets/timings/Jeremiah.json"),
  Lam: require("../assets/timings/Lamentations.json"),
  Ezk: require("../assets/timings/Ezekiel.json"),
  Dan: require("../assets/timings/Daniel.json"),
  Hos: require("../assets/timings/Hosea.json"),
  Jol: require("../assets/timings/Joel.json"),
  Amo: require("../assets/timings/Amos.json"),
  Oba: require("../assets/timings/Obadiah.json"),
  Jon: require("../assets/timings/Jonah.json"),
  Mic: require("../assets/timings/Micah.json"),
  Nam: require("../assets/timings/Nahum.json"),
  Hab: require("../assets/timings/Habakkuk.json"),
  Zep: require("../assets/timings/Zephaniah.json"),
  Hag: require("../assets/timings/Haggai.json"),
  Zec: require("../assets/timings/Zechariah.json"),
  Mal: require("../assets/timings/Malachi.json"),
  Mat: require("../assets/timings/Matthew.json"),
  Mrk: require("../assets/timings/Mark.json"),
  Luk: require("../assets/timings/Luke.json"),
  Jhn: require("../assets/timings/John.json"),
  Act: require("../assets/timings/Acts.json"),
  Rom: require("../assets/timings/Romans.json"),
  "1Co": require("../assets/timings/1Corinthians.json"),
  "2Co": require("../assets/timings/2Corinthians.json"),
  Gal: require("../assets/timings/Galatians.json"),
  Eph: require("../assets/timings/Ephesians.json"),
  Php: require("../assets/timings/Philippians.json"),
  Col: require("../assets/timings/Colossians.json"),
  "1Th": require("../assets/timings/1Thessalonians.json"),
  "2Th": require("../assets/timings/2Thessalonians.json"),
  "1Ti": require("../assets/timings/1Timothy.json"),
  "2Ti": require("../assets/timings/2Timothy.json"),
  Tit: require("../assets/timings/Titus.json"),
  Phm: require("../assets/timings/Philemon.json"),
  Heb: require("../assets/timings/Hebrews.json"),
  Jas: require("../assets/timings/James.json"),
  "1Pe": require("../assets/timings/1Peter.json"),
  "2Pe": require("../assets/timings/2Peter.json"),
  "1Jn": require("../assets/timings/1John.json"),
  "2Jn": require("../assets/timings/2John.json"),
  "3Jn": require("../assets/timings/3John.json"),
  Jud: require("../assets/timings/Jude.json"),
  Rev: require("../assets/timings/Revelation.json"),
};

/** Timing for one chapter, or null when that chapter hasn't been aligned. */
export function getChapterTiming(abbrev: string, chapter: number): ChapterTiming | null {
  const c = FILES[abbrev]?.chapters?.[String(chapter)];
  return c && Array.isArray(c.verses) && c.verses.length > 0 ? c : null;
}
