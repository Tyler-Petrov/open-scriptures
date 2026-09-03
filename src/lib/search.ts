import { BOOKS } from "./bible";

// Lazy-loaded per-book JSON (static require map in bible.ts).
const FILES: Record<string, { name: string; chapters: string[][] }> = {
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

export type SearchHit = {
  verseKey: string;
  ref: string;
  text: string;
};

export async function searchBible(
  q: string,
  limit = 40
): Promise<SearchHit[]> {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const hits: SearchHit[] = [];

  for (const book of BOOKS) {
    const data = FILES[book.abbrev];
    if (!data) continue;
    for (let c = 0; c < data.chapters.length; c++) {
      const chapter = data.chapters[c];
      for (let v = 0; v < chapter.length; v++) {
        const text = chapter[v];
        const lower = text.toLowerCase();
        let all = true;
        for (const term of terms) {
          if (!lower.includes(term)) {
            all = false;
            break;
          }
        }
        if (all) {
          hits.push({
            verseKey: `${book.abbrev}.${c + 1}.${v + 1}`,
            ref: `${book.name} ${c + 1}:${v + 1}`,
            text,
          });
          if (hits.length >= limit) return hits;
        }
      }
    }
  }
  return hits;
}
