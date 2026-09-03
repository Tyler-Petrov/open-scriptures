import { findBook } from "./books";

/** `${abbrev}.${chapter}.${verse}`, e.g. "Gen.1.1". */
export type VerseKey = string;

export type VerseRef = { abbrev: string; chapter: number; verse: number };

export function makeVerseKey(abbrev: string, chapter: number, verse: number): VerseKey {
  return `${abbrev}.${chapter}.${verse}`;
}

export function parseVerseKey(verseKey: string): VerseRef {
  const [abbrev, chapter, verse] = verseKey.split(".");
  return { abbrev, chapter: Number(chapter), verse: Number(verse) };
}

export function isValidVerseKey(verseKey: string): boolean {
  const { abbrev, chapter, verse } = parseVerseKey(verseKey);
  const meta = findBook(abbrev);
  return (
    !!meta &&
    Number.isInteger(chapter) &&
    chapter >= 1 &&
    chapter <= meta.chapters &&
    Number.isInteger(verse) &&
    verse >= 1
  );
}

/** "Gen.1.1" → "Genesis 1:1". Unknown keys are returned unchanged. */
export function ref(verseKey: string): string {
  const { abbrev, chapter, verse } = parseVerseKey(verseKey);
  const meta = findBook(abbrev);
  if (!meta) return verseKey;
  return `${meta.name} ${chapter}:${verse}`;
}
