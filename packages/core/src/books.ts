export type Testament = "OT" | "NT";

export type BookMeta = {
  /** Display name, e.g. "1 Samuel". */
  name: string;
  /** App-wide abbreviation used in verse keys, e.g. "1Sa". */
  abbrev: string;
  testament: Testament;
  /** Number of chapters. */
  chapters: number;
  /** USFM/Paratext id used by API.Bible, e.g. "1SA". */
  apiBibleId: string;
};

const OT: [string, string, number][] = [
  ["Gen", "Genesis", 50],
  ["Exo", "Exodus", 40],
  ["Lev", "Leviticus", 27],
  ["Num", "Numbers", 36],
  ["Deu", "Deuteronomy", 34],
  ["Jos", "Joshua", 24],
  ["Jdg", "Judges", 21],
  ["Rut", "Ruth", 4],
  ["1Sa", "1 Samuel", 31],
  ["2Sa", "2 Samuel", 24],
  ["1Ki", "1 Kings", 22],
  ["2Ki", "2 Kings", 25],
  ["1Ch", "1 Chronicles", 29],
  ["2Ch", "2 Chronicles", 36],
  ["Ezr", "Ezra", 10],
  ["Neh", "Nehemiah", 13],
  ["Est", "Esther", 10],
  ["Job", "Job", 42],
  ["Psa", "Psalms", 150],
  ["Pro", "Proverbs", 31],
  ["Ecc", "Ecclesiastes", 12],
  ["Sng", "Song of Solomon", 8],
  ["Isa", "Isaiah", 66],
  ["Jer", "Jeremiah", 52],
  ["Lam", "Lamentations", 5],
  ["Ezk", "Ezekiel", 48],
  ["Dan", "Daniel", 12],
  ["Hos", "Hosea", 14],
  ["Jol", "Joel", 3],
  ["Amo", "Amos", 9],
  ["Oba", "Obadiah", 1],
  ["Jon", "Jonah", 4],
  ["Mic", "Micah", 7],
  ["Nam", "Nahum", 3],
  ["Hab", "Habakkuk", 3],
  ["Zep", "Zephaniah", 3],
  ["Hag", "Haggai", 2],
  ["Zec", "Zechariah", 14],
  ["Mal", "Malachi", 4],
];

const NT: [string, string, number][] = [
  ["Mat", "Matthew", 28],
  ["Mrk", "Mark", 16],
  ["Luk", "Luke", 24],
  ["Jhn", "John", 21],
  ["Act", "Acts", 28],
  ["Rom", "Romans", 16],
  ["1Co", "1 Corinthians", 16],
  ["2Co", "2 Corinthians", 13],
  ["Gal", "Galatians", 6],
  ["Eph", "Ephesians", 6],
  ["Php", "Philippians", 4],
  ["Col", "Colossians", 4],
  ["1Th", "1 Thessalonians", 5],
  ["2Th", "2 Thessalonians", 3],
  ["1Ti", "1 Timothy", 6],
  ["2Ti", "2 Timothy", 4],
  ["Tit", "Titus", 3],
  ["Phm", "Philemon", 1],
  ["Heb", "Hebrews", 13],
  ["Jas", "James", 5],
  ["1Pe", "1 Peter", 5],
  ["2Pe", "2 Peter", 3],
  ["1Jn", "1 John", 5],
  ["2Jn", "2 John", 1],
  ["3Jn", "3 John", 1],
  ["Jud", "Jude", 1],
  ["Rev", "Revelation", 22],
];

function build(rows: [string, string, number][], testament: Testament): BookMeta[] {
  return rows.map(([abbrev, name, chapters]) => ({
    name,
    abbrev,
    testament,
    chapters,
    apiBibleId: abbrev.toUpperCase(),
  }));
}

/** All 66 books in canonical order (39 OT, 27 NT). */
export const BOOKS: BookMeta[] = [...build(OT, "OT"), ...build(NT, "NT")];

const BY_ABBREV = new Map(BOOKS.map((b) => [b.abbrev, b]));
const BY_API_ID = new Map(BOOKS.map((b) => [b.apiBibleId, b]));
const BY_NAME = new Map(BOOKS.map((b) => [b.name.toLowerCase(), b]));

export function findBook(abbrev: string): BookMeta | undefined {
  return BY_ABBREV.get(abbrev);
}

export function getBookMeta(abbrev: string): BookMeta {
  const meta = BY_ABBREV.get(abbrev);
  if (!meta) throw new Error(`Unknown book abbrev: ${abbrev}`);
  return meta;
}

export function getChapterCount(abbrev: string): number {
  return getBookMeta(abbrev).chapters;
}

export function bookByApiBibleId(id: string): BookMeta | undefined {
  return BY_API_ID.get(id.toUpperCase());
}

/** Match a display name, e.g. "Song of Solomon" or "1 john". */
export function bookByName(name: string): BookMeta | undefined {
  return BY_NAME.get(name.trim().replace(/\s+/g, " ").toLowerCase());
}

export function isValidChapter(abbrev: string, chapter: number): boolean {
  const meta = BY_ABBREV.get(abbrev);
  return !!meta && Number.isInteger(chapter) && chapter >= 1 && chapter <= meta.chapters;
}
