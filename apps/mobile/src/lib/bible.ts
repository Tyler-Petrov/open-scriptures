// Book table and verse-key helpers come from @openscripture/core (shared with the
// backend). The bundled KJV JSON stays in the app for Strong's word spans,
// audio timings and the semantic index — all aligned to this exact text — and
// is the seed source for the KJV served by Convex.
export {
  BOOKS,
  findBook,
  getBookMeta,
  getChapterCount,
  ref,
  type BookMeta,
} from "@openscripture/core";

const FILES: Record<string, any> = {
  Gen: require("../assets/bible/Genesis.json"),
  Exo: require("../assets/bible/Exodus.json"),
  Lev: require("../assets/bible/Leviticus.json"),
  Num: require("../assets/bible/Numbers.json"),
  Deu: require("../assets/bible/Deuteronomy.json"),
  Jos: require("../assets/bible/Joshua.json"),
  Jdg: require("../assets/bible/Judges.json"),
  Rut: require("../assets/bible/Ruth.json"),
  "1Sa": require("../assets/bible/1Samuel.json"),
  "2Sa": require("../assets/bible/2Samuel.json"),
  "1Ki": require("../assets/bible/1Kings.json"),
  "2Ki": require("../assets/bible/2Kings.json"),
  "1Ch": require("../assets/bible/1Chronicles.json"),
  "2Ch": require("../assets/bible/2Chronicles.json"),
  Ezr: require("../assets/bible/Ezra.json"),
  Neh: require("../assets/bible/Nehemiah.json"),
  Est: require("../assets/bible/Esther.json"),
  Job: require("../assets/bible/Job.json"),
  Psa: require("../assets/bible/Psalms.json"),
  Pro: require("../assets/bible/Proverbs.json"),
  Ecc: require("../assets/bible/Ecclesiastes.json"),
  Sng: require("../assets/bible/SongofSolomon.json"),
  Isa: require("../assets/bible/Isaiah.json"),
  Jer: require("../assets/bible/Jeremiah.json"),
  Lam: require("../assets/bible/Lamentations.json"),
  Ezk: require("../assets/bible/Ezekiel.json"),
  Dan: require("../assets/bible/Daniel.json"),
  Hos: require("../assets/bible/Hosea.json"),
  Jol: require("../assets/bible/Joel.json"),
  Amo: require("../assets/bible/Amos.json"),
  Oba: require("../assets/bible/Obadiah.json"),
  Jon: require("../assets/bible/Jonah.json"),
  Mic: require("../assets/bible/Micah.json"),
  Nam: require("../assets/bible/Nahum.json"),
  Hab: require("../assets/bible/Habakkuk.json"),
  Zep: require("../assets/bible/Zephaniah.json"),
  Hag: require("../assets/bible/Haggai.json"),
  Zec: require("../assets/bible/Zechariah.json"),
  Mal: require("../assets/bible/Malachi.json"),
  Mat: require("../assets/bible/Matthew.json"),
  Mrk: require("../assets/bible/Mark.json"),
  Luk: require("../assets/bible/Luke.json"),
  Jhn: require("../assets/bible/John.json"),
  Act: require("../assets/bible/Acts.json"),
  Rom: require("../assets/bible/Romans.json"),
  "1Co": require("../assets/bible/1Corinthians.json"),
  "2Co": require("../assets/bible/2Corinthians.json"),
  Gal: require("../assets/bible/Galatians.json"),
  Eph: require("../assets/bible/Ephesians.json"),
  Php: require("../assets/bible/Philippians.json"),
  Col: require("../assets/bible/Colossians.json"),
  "1Th": require("../assets/bible/1Thessalonians.json"),
  "2Th": require("../assets/bible/2Thessalonians.json"),
  "1Ti": require("../assets/bible/1Timothy.json"),
  "2Ti": require("../assets/bible/2Timothy.json"),
  Tit: require("../assets/bible/Titus.json"),
  Phm: require("../assets/bible/Philemon.json"),
  Heb: require("../assets/bible/Hebrews.json"),
  Jas: require("../assets/bible/James.json"),
  "1Pe": require("../assets/bible/1Peter.json"),
  "2Pe": require("../assets/bible/2Peter.json"),
  "1Jn": require("../assets/bible/1John.json"),
  "2Jn": require("../assets/bible/2John.json"),
  "3Jn": require("../assets/bible/3John.json"),
  Jud: require("../assets/bible/Jude.json"),
  Rev: require("../assets/bible/Revelation.json"),
};


/** KJV chapter from the bundled assets (synchronous, offline). Empty if out of range. */
export function getBundledChapter(abbrev: string, chapter: number): string[] {
  const data = FILES[abbrev] as { chapters: string[][] } | undefined;
  if (!data || chapter < 1 || chapter > data.chapters.length) return [];
  // Return a copy so callers can't mutate the bundled data.
  return data.chapters[chapter - 1].slice();
}

/** Every verseKey in canonical order — matches the semantic index row order. */
export function allVerseKeys(): string[] {
  const keys: string[] = [];
  for (const abbrev of Object.keys(FILES)) {
    const data = FILES[abbrev] as { chapters: string[][] };
    for (let c = 0; c < data.chapters.length; c++) {
      for (let v = 0; v < data.chapters[c].length; v++) {
        keys.push(`${abbrev}.${c + 1}.${v + 1}`);
      }
    }
  }
  return keys;
}
