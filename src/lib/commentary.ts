// David Guzik (Enduring Word) commentary, built by
// scripts/commentary/build-guzik.py. Entries are [from, to, text] per
// chapter; a verse resolves to every entry whose range contains it.

import { getBookMeta } from "@/lib/bible";

type Entry = [number, number, string];
type CommentaryBook = { book: string; chapters: Entry[][] };

export type CommentaryHit = {
  writerId: string;
  writer: string;
  ref: string;
  from: number;
  to: number;
  text: string;
};

const GUZIK_LOADERS: Record<string, () => CommentaryBook> = {
  Gen: () => require("../assets/commentary/guzik/Genesis.json"),
  Exo: () => require("../assets/commentary/guzik/Exodus.json"),
  Lev: () => require("../assets/commentary/guzik/Leviticus.json"),
  Num: () => require("../assets/commentary/guzik/Numbers.json"),
  Deu: () => require("../assets/commentary/guzik/Deuteronomy.json"),
  Jos: () => require("../assets/commentary/guzik/Joshua.json"),
  Jdg: () => require("../assets/commentary/guzik/Judges.json"),
  Rut: () => require("../assets/commentary/guzik/Ruth.json"),
  "1Sa": () => require("../assets/commentary/guzik/1Samuel.json"),
  "2Sa": () => require("../assets/commentary/guzik/2Samuel.json"),
  "1Ki": () => require("../assets/commentary/guzik/1Kings.json"),
  "2Ki": () => require("../assets/commentary/guzik/2Kings.json"),
  "1Ch": () => require("../assets/commentary/guzik/1Chronicles.json"),
  "2Ch": () => require("../assets/commentary/guzik/2Chronicles.json"),
  Ezr: () => require("../assets/commentary/guzik/Ezra.json"),
  Neh: () => require("../assets/commentary/guzik/Nehemiah.json"),
  Est: () => require("../assets/commentary/guzik/Esther.json"),
  Job: () => require("../assets/commentary/guzik/Job.json"),
  Psa: () => require("../assets/commentary/guzik/Psalms.json"),
  Pro: () => require("../assets/commentary/guzik/Proverbs.json"),
  Ecc: () => require("../assets/commentary/guzik/Ecclesiastes.json"),
  Sng: () => require("../assets/commentary/guzik/SongofSolomon.json"),
  Isa: () => require("../assets/commentary/guzik/Isaiah.json"),
  Jer: () => require("../assets/commentary/guzik/Jeremiah.json"),
  Lam: () => require("../assets/commentary/guzik/Lamentations.json"),
  Ezk: () => require("../assets/commentary/guzik/Ezekiel.json"),
  Dan: () => require("../assets/commentary/guzik/Daniel.json"),
  Hos: () => require("../assets/commentary/guzik/Hosea.json"),
  Jol: () => require("../assets/commentary/guzik/Joel.json"),
  Amo: () => require("../assets/commentary/guzik/Amos.json"),
  Oba: () => require("../assets/commentary/guzik/Obadiah.json"),
  Jon: () => require("../assets/commentary/guzik/Jonah.json"),
  Mic: () => require("../assets/commentary/guzik/Micah.json"),
  Nam: () => require("../assets/commentary/guzik/Nahum.json"),
  Hab: () => require("../assets/commentary/guzik/Habakkuk.json"),
  Zep: () => require("../assets/commentary/guzik/Zephaniah.json"),
  Hag: () => require("../assets/commentary/guzik/Haggai.json"),
  Zec: () => require("../assets/commentary/guzik/Zechariah.json"),
  Mal: () => require("../assets/commentary/guzik/Malachi.json"),
  Mat: () => require("../assets/commentary/guzik/Matthew.json"),
  Mrk: () => require("../assets/commentary/guzik/Mark.json"),
  Luk: () => require("../assets/commentary/guzik/Luke.json"),
  Jhn: () => require("../assets/commentary/guzik/John.json"),
  Act: () => require("../assets/commentary/guzik/Acts.json"),
  Rom: () => require("../assets/commentary/guzik/Romans.json"),
  "1Co": () => require("../assets/commentary/guzik/1Corinthians.json"),
  "2Co": () => require("../assets/commentary/guzik/2Corinthians.json"),
  Gal: () => require("../assets/commentary/guzik/Galatians.json"),
  Eph: () => require("../assets/commentary/guzik/Ephesians.json"),
  Php: () => require("../assets/commentary/guzik/Philippians.json"),
  Col: () => require("../assets/commentary/guzik/Colossians.json"),
  "1Th": () => require("../assets/commentary/guzik/1Thessalonians.json"),
  "2Th": () => require("../assets/commentary/guzik/2Thessalonians.json"),
  "1Ti": () => require("../assets/commentary/guzik/1Timothy.json"),
  "2Ti": () => require("../assets/commentary/guzik/2Timothy.json"),
  Tit: () => require("../assets/commentary/guzik/Titus.json"),
  Phm: () => require("../assets/commentary/guzik/Philemon.json"),
  Heb: () => require("../assets/commentary/guzik/Hebrews.json"),
  Jas: () => require("../assets/commentary/guzik/James.json"),
  "1Pe": () => require("../assets/commentary/guzik/1Peter.json"),
  "2Pe": () => require("../assets/commentary/guzik/2Peter.json"),
  "1Jn": () => require("../assets/commentary/guzik/1John.json"),
  "2Jn": () => require("../assets/commentary/guzik/2John.json"),
  "3Jn": () => require("../assets/commentary/guzik/3John.json"),
  Jud: () => require("../assets/commentary/guzik/Jude.json"),
  Rev: () => require("../assets/commentary/guzik/Revelation.json"),
};

const cache = new Map<string, CommentaryBook>();

export function getCommentaryFor(
  abbrev: string,
  chapter: number,
  verse: number
): CommentaryHit[] {
  const hits: CommentaryHit[] = [];
  let bookName = abbrev;
  try {
    bookName = getBookMeta(abbrev).name;
  } catch {
    return hits;
  }
  const loader = GUZIK_LOADERS[abbrev];
  if (!loader) return hits;
  let data = cache.get(abbrev);
  if (!data) {
    data = loader();
    cache.set(abbrev, data);
  }
  const entries = data.chapters[chapter - 1] ?? [];
  for (const [f, t, text] of entries) {
    if (verse >= f && verse <= t) {
      hits.push({
        writerId: "guzik",
        writer: "David Guzik",
        ref: `${bookName} ${chapter}:${f}${t > f ? `–${t}` : ""}`,
        from: f,
        to: t,
        text,
      });
    }
  }
  return hits;
}
