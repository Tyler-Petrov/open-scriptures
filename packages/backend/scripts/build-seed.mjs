// Turns the app's bundled KJV JSON into JSONL for `npx convex import`.
// Usage: npm run seed:build   (then npm run seed:push)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BOOKS } from "../../core/src/books.ts";

const ASSETS = fileURLToPath(new URL("../../../apps/mobile/src/assets/bible/", import.meta.url));
const OUT = fileURLToPath(new URL("../seed/", import.meta.url));
const TRANSLATION = "KJV";

mkdirSync(OUT, { recursive: true });
const chapterLines = [];
const verseLines = [];

for (const book of BOOKS) {
  const data = JSON.parse(readFileSync(`${ASSETS}${book.file}.json`, "utf8"));
  if (data.abbrev !== book.abbrev) throw new Error(`${book.file}: abbrev ${data.abbrev} != ${book.abbrev}`);
  if (data.chapters.length !== book.chapters) {
    throw new Error(`${book.file}: ${data.chapters.length} chapters, core says ${book.chapters}`);
  }
  data.chapters.forEach((verses, ci) => {
    const chapter = ci + 1;
    chapterLines.push(JSON.stringify({ translation: TRANSLATION, book: book.abbrev, chapter, verses }));
    verses.forEach((text, vi) => {
      verseLines.push(JSON.stringify({ translation: TRANSLATION, book: book.abbrev, chapter, verse: vi + 1, text }));
    });
  });
}

writeFileSync(`${OUT}bundledChapters.jsonl`, chapterLines.join("\n") + "\n");
writeFileSync(`${OUT}bundledVerses.jsonl`, verseLines.join("\n") + "\n");
console.log(`${chapterLines.length} chapters, ${verseLines.length} verses → ${OUT}`);
if (chapterLines.length !== 1189 || verseLines.length !== 31102) {
  throw new Error("Unexpected KJV counts (want 1189 chapters / 31102 verses)");
}
