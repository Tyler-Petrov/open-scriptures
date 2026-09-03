#!/usr/bin/env node
/**
 * build-bible.mjs — downloads the public-domain KJV Bible (source:
 * github.com/aruljohn/Bible-kjv, per-book JSON files) and writes 66 JSON
 * files to src/assets/bible/{BookName}.json in the contract shape:
 *   { "name": "Genesis", "abbrev": "Gen", "chapters": [["v1","v2",...], ...] }
 * Then verifies: 66 files, 1189 chapters, ~31102 verses, sample verses,
 * and runs an inlined searchBible test.
 *
 * Usage: node scripts/build-bible.mjs [--force]  (--force re-downloads)
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "src", "assets", "bible");
const RAW_BASE = "https://raw.githubusercontent.com/aruljohn/Bible-kjv/master/";

/** Book list: [abbrev, sourceFileName (no .json), displayName, testament, expectedChapters] */
const BOOKS = [
  ["Gen", "Genesis", "Genesis", "OT", 50],
  ["Exo", "Exodus", "Exodus", "OT", 40],
  ["Lev", "Leviticus", "Leviticus", "OT", 27],
  ["Num", "Numbers", "Numbers", "OT", 36],
  ["Deu", "Deuteronomy", "Deuteronomy", "OT", 34],
  ["Jos", "Joshua", "Joshua", "OT", 24],
  ["Jdg", "Judges", "Judges", "OT", 21],
  ["Rut", "Ruth", "Ruth", "OT", 4],
  ["1Sa", "1Samuel", "1 Samuel", "OT", 31],  ["2Sa", "2Samuel", "2 Samuel", "OT", 24],
  ["1Ki", "1Kings", "1 Kings", "OT", 22],
  ["2Ki", "2Kings", "2 Kings", "OT", 25],
  ["1Ch", "1Chronicles", "1 Chronicles", "OT", 29],
  ["2Ch", "2Chronicles", "2 Chronicles", "OT", 36],
  ["Ezr", "Ezra", "Ezra", "OT", 10],
  ["Neh", "Nehemiah", "Nehemiah", "OT", 13],
  ["Est", "Esther", "Esther", "OT", 10],
  ["Job", "Job", "Job", "OT", 42],
  ["Psa", "Psalms", "Psalms", "OT", 150],
  ["Pro", "Proverbs", "Proverbs", "OT", 31],
  ["Ecc", "Ecclesiastes", "Ecclesiastes", "OT", 12],
  ["Sng", "SongofSolomon", "Song of Solomon", "OT", 8],
  ["Isa", "Isaiah", "Isaiah", "OT", 66],
  ["Jer", "Jeremiah", "Jeremiah", "OT", 52],
  ["Lam", "Lamentations", "Lamentations", "OT", 5],
  ["Ezk", "Ezekiel", "Ezekiel", "OT", 48],
  ["Dan", "Daniel", "Daniel", "OT", 12],
  ["Hos", "Hosea", "Hosea", "OT", 14],
  ["Jol", "Joel", "Joel", "OT", 3],
  ["Amo", "Amos", "Amos", "OT", 9],
  ["Oba", "Obadiah", "Obadiah", "OT", 1],
  ["Jon", "Jonah", "Jonah", "OT", 4],
  ["Mic", "Micah", "Micah", "OT", 7],
  ["Nam", "Nahum", "Nahum", "OT", 3],
  ["Hab", "Habakkuk", "Habakkuk", "OT", 3],
  ["Zep", "Zephaniah", "Zephaniah", "OT", 3],
  ["Hag", "Haggai", "Haggai", "OT", 2],
  ["Zec", "Zechariah", "Zechariah", "OT", 14],
  ["Mal", "Malachi", "Malachi", "OT", 4],
  ["Mat", "Matthew", "Matthew", "NT", 28],
  ["Mrk", "Mark", "Mark", "NT", 16],
  ["Luk", "Luke", "Luke", "NT", 24],
  ["Jhn", "John", "John", "NT", 21],
  ["Act", "Acts", "Acts", "NT", 28],
  ["Rom", "Romans", "Romans", "NT", 16],
  ["1Co", "1Corinthians", "1 Corinthians", "NT", 16],
  ["2Co", "2Corinthians", "2 Corinthians", "NT", 13],
  ["Gal", "Galatians", "Galatians", "NT", 6],
];
BOOKS.push(
  ["Eph", "Ephesians", "Ephesians", "NT", 6],
  ["Php", "Philippians", "Philippians", "NT", 4],
  ["Col", "Colossians", "Colossians", "NT", 4],
  ["1Th", "1Thessalonians", "1 Thessalonians", "NT", 5],
  ["2Th", "2Thessalonians", "2 Thessalonians", "NT", 3],
  ["1Ti", "1Timothy", "1 Timothy", "NT", 6],
  ["2Ti", "2Timothy", "2 Timothy", "NT", 4],
  ["Tit", "Titus", "Titus", "NT", 3],
  ["Phm", "Philemon", "Philemon", "NT", 1],
  ["Heb", "Hebrews", "Hebrews", "NT", 13],
  ["Jas", "James", "James", "NT", 5],
  ["1Pe", "1Peter", "1 Peter", "NT", 5],
  ["2Pe", "2Peter", "2 Peter", "NT", 3],
  ["1Jn", "1John", "1 John", "NT", 5],
  ["2Jn", "2John", "2 John", "NT", 1],
  ["3Jn", "3John", "3 John", "NT", 1],
  ["Jud", "Jude", "Jude", "NT", 1],
  ["Rev", "Revelation", "Revelation", "NT", 22]
);

if (BOOKS.length !== 66) {
  console.error("FATAL: BOOKS table must have exactly 66 entries, got", BOOKS.length);
  process.exit(1);
}

/** Fetch text with a couple retries. */
async function fetchText(url, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

function normalizeText(text) {
  return String(text)
    .replace(/\s+/g, " ")
    .trim();
}

async function downloadAndConvert() {
  await mkdir(OUT_DIR, { recursive: true });
  let totalVerses = 0;
  const failures = [];

  for (const [abbrev, srcName, displayName, testament, expectedChapters] of BOOKS) {
    const outFile = path.join(OUT_DIR, `${srcName}.json`);
    const cached = existsSync(outFile) && (await readFile(outFile, "utf8"));

    // Reuse an existing file if it is valid and we are not forcing a redownload
    if (!process.argv.includes("--force") && cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed?.abbrev === abbrev && Array.isArray(parsed.chapters)) {
          totalVerses += parsed.chapters.reduce((n, c) => n + c.length, 0);
          continue;
        }
      } catch {
        /* fall through to re-download */
      }
    }

    process.stdout.write(`Fetching ${srcName}.json ... `);
    const raw = JSON.parse(await fetchText(`${RAW_BASE}${srcName}.json`));
    const verses = raw.chapters; // [{chapter, verses:[{verse,text}]}]

    const chapters = verses.map((ch) =>
      ch.verses.map((v) => normalizeText(v.text))
    );

    // sanity per book
    if (chapters.length !== expectedChapters) {
      failures.push(
        `${srcName}: got ${chapters.length} chapters, expected ${expectedChapters}`
      );
    }

    const out = { name: displayName, abbrev, chapters };
    await writeFile(outFile, JSON.stringify(out));
    totalVerses += chapters.reduce((n, c) => n + c.length, 0);
    console.log(
      `ok (${chapters.length} ch, ${chapters.reduce((n, c) => n + c.length, 0)} vs)`
    );
  }

  return { totalVerses, failures };
}

async function verify() {
  console.log("\n=== VERIFY ===");
  const problems = [];
  let totalChapters = 0;
  let totalVerses = 0;

  const samples = [
    ["Gen", 1, 1, "In the beginning God created the heaven and the earth."],
    [
      "Jhn",
      3,
      16,
      "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
    ],
    ["Rev", 22, 21, "The grace of our Lord Jesus Christ be with you all. Amen."],
    ["Psa", 23, 1, "The LORD is my shepherd; I shall not want."],
  ];

  const data = new Map(); // abbrev -> {name, chapters}
  for (const [abbrev, srcName, displayName] of BOOKS) {
    const raw = await readFile(path.join(OUT_DIR, `${srcName}.json`), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed.abbrev !== abbrev) problems.push(`${srcName}: abbrev mismatch`);
    if (parsed.name !== displayName) problems.push(`${srcName}: name mismatch`);
    if (!Array.isArray(parsed.chapters) || parsed.chapters.length < 1)
      problems.push(`${srcName}: no chapters`);
    if (Array.isArray(parsed.chapters) && parsed.chapters.some((c) => !Array.isArray(c) || c.length < 1))
      problems.push(`${srcName}: empty chapter`);
    data.set(abbrev, parsed);
    totalChapters += parsed.chapters.length;
    totalVerses += parsed.chapters.reduce((n, c) => n + c.length, 0);
  }

  for (const [abbrev, ch, vs, expected] of samples) {
    const book = data.get(abbrev);
    const actual = book?.chapters?.[ch - 1]?.[vs - 1];
    if (actual !== expected)
      problems.push(`${abbrev} ${ch}:${vs} mismatch:\n  got: ${JSON.stringify(actual)}`);
    else console.log(`ok ${abbrev} ${ch}:${vs}`);
  }

  // Psalm 23 fully present
  const psa23 = data.get("Psa").chapters[22];
  if (psa23.length !== 6)
    problems.push(`Psa 23 should have 6 verses, got ${psa23.length}`);

  // Inlined search algorithm (mirrors src/lib/search.ts)
  const terms = "so loved the world".toLowerCase().split(/\s+/).filter(Boolean);
  const hits = [];
  outer: for (const [abbrev, , displayName] of BOOKS) {
    const book = data.get(abbrev);
    for (let c = 0; c < book.chapters.length; c++) {
      for (let v = 0; v < book.chapters[c].length; v++) {
        const text = book.chapters[c][v].toLowerCase();
        if (terms.every((t) => text.includes(t))) {
          hits.push({ verseKey: `${abbrev}.${c + 1}.${v + 1}`, ref: `${displayName} ${c + 1}:${v + 1}`, text: book.chapters[c][v] });
          if (hits.length >= 40) break outer;
        }
      }
    }
  }
  const jhn316 = hits.find((h) => h.verseKey === "Jhn.3.16");
  if (!jhn316) problems.push("search 'so loved the world' did not return Jhn.3.16");
  else console.log(`ok search: Jhn 3:16 -> ${jhn316.text.slice(0, 60)}...`);

  console.log(`\nBooks: ${data.size} (expect 66)`);
  console.log(`Chapters: ${totalChapters} (expect 1189)`);
  console.log(`Verses: ${totalVerses} (expect ~31102)`);

  if (data.size !== 66) problems.push(`book count ${data.size} != 66`);
  if (totalChapters !== 1189) problems.push(`chapter count ${totalChapters} != 1189`);
  if (totalVerses !== 31102)
    problems.push(`verse count ${totalVerses} (KJV canonical is 31102; off by ${totalVerses - 31102})`);

  if (problems.length) {
    console.log("\nPROBLEMS:");
    for (const p of problems) console.log(" -", p);
    process.exit(1);
  }
  console.log("\nALL CHECKS PASSED ✓");
}

await downloadAndConvert();
await verify();
