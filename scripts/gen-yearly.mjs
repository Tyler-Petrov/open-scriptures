// Generates the two yearly plans (yearly-canonical, yearly-blended) into
// src/assets/plans/ per the PLANS contract in CONTRACT.md.
//
// Run: node scripts/gen-yearly.mjs
//
// The script reads per-book chapter counts from src/assets/bible/*.json so the
// plan data always matches the bundled KJV text. It asserts, for each plan:
//   - exactly 365 days, numbered 1..365 in order
//   - every one of the 1,189 chapters appears exactly once (no gaps, no overlaps)
//   - every passage is within the book's real chapter count

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const BIBLE_DIR = path.join(ROOT, "src", "assets", "bible");
const OUT_DIR = path.join(ROOT, "src", "assets", "plans");

// Canonical order (39 OT + 27 NT) with the data filenames used by src/lib/bible.ts
const BOOK_FILES = [
  ["Gen", "Genesis.json"],
  ["Exo", "Exodus.json"],
  ["Lev", "Leviticus.json"],
  ["Num", "Numbers.json"],
  ["Deu", "Deuteronomy.json"],
  ["Jos", "Joshua.json"],
  ["Jdg", "Judges.json"],
  ["Rut", "Ruth.json"],
  ["1Sa", "1Samuel.json"],
  ["2Sa", "2Samuel.json"],
  ["1Ki", "1Kings.json"],
  ["2Ki", "2Kings.json"],
  ["1Ch", "1Chronicles.json"],
  ["2Ch", "2Chronicles.json"],
  ["Ezr", "Ezra.json"],
  ["Neh", "Nehemiah.json"],
  ["Est", "Esther.json"],
  ["Job", "Job.json"],
  ["Psa", "Psalms.json"],
  ["Pro", "Proverbs.json"],
  ["Ecc", "Ecclesiastes.json"],
  ["Sng", "SongofSolomon.json"],
  ["Isa", "Isaiah.json"],
  ["Jer", "Jeremiah.json"],
  ["Lam", "Lamentations.json"],
  ["Ezk", "Ezekiel.json"],
  ["Dan", "Daniel.json"],
  ["Hos", "Hosea.json"],
  ["Jol", "Joel.json"],
  ["Amo", "Amos.json"],
  ["Oba", "Obadiah.json"],
  ["Jon", "Jonah.json"],
  ["Mic", "Micah.json"],
  ["Nam", "Nahum.json"],
  ["Hab", "Habakkuk.json"],
  ["Zep", "Zephaniah.json"],
  ["Hag", "Haggai.json"],
  ["Zec", "Zechariah.json"],
  ["Mal", "Malachi.json"],
  ["Mat", "Matthew.json"],
  ["Mrk", "Mark.json"],
  ["Luk", "Luke.json"],
  ["Jhn", "John.json"],
  ["Act", "Acts.json"],
  ["Rom", "Romans.json"],
  ["1Co", "1Corinthians.json"],
  ["2Co", "2Corinthians.json"],
  ["Gal", "Galatians.json"],
  ["Eph", "Ephesians.json"],
  ["Php", "Philippians.json"],
  ["Col", "Colossians.json"],
  ["1Th", "1Thessalonians.json"],
  ["2Th", "2Thessalonians.json"],
  ["1Ti", "1Timothy.json"],
  ["2Ti", "2Timothy.json"],
  ["Tit", "Titus.json"],
  ["Phm", "Philemon.json"],
  ["Heb", "Hebrews.json"],
  ["Jas", "James.json"],
  ["1Pe", "1Peter.json"],
  ["2Pe", "2Peter.json"],
  ["1Jn", "1John.json"],
  ["2Jn", "2John.json"],
  ["3Jn", "3John.json"],
  ["Jud", "Jude.json"],
  ["Rev", "Revelation.json"],
];

const OT_COUNT = 39;

// Load real chapter counts from the bundled bible data
const chapterCount = new Map();
for (const [abbrev, file] of BOOK_FILES) {
  const p = path.join(BIBLE_DIR, file);
  if (!fs.existsSync(p)) {
    console.error(`Missing bible data file: ${p}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  chapterCount.set(abbrev, data.chapters.length);
}

const otTotal = [...chapterCount.values()].slice(0, OT_COUNT).reduce((a, b) => a + b, 0);
const ntTotal = [...chapterCount.values()].slice(OT_COUNT).reduce((a, b) => a + b, 0);
if (otTotal !== 929 || ntTotal !== 260) {
  console.error(`Unexpected chapter totals: OT=${otTotal} NT=${ntTotal} (expected 929/260)`);
  process.exit(1);
}
console.log(`Loaded 66 books from src/assets/bible: OT=${otTotal} chapters, NT=${ntTotal} chapters, total=${otTotal + ntTotal}`);

// Flatten the canonical order into per-chapter entries
function orderedChapters(abbrevs) {
  const out = [];
  for (const abbrev of abbrevs) {
    for (let ch = 1; ch <= chapterCount.get(abbrev); ch++) {
      out.push({ abbrev, ch });
    }
  }
  return out;
}

const OT_ORDER = orderedChapters(BOOK_FILES.slice(0, OT_COUNT).map(([a]) => a));
const NT_ORDER = orderedChapters(BOOK_FILES.slice(OT_COUNT).map(([a]) => a));

function groupPassages(entries) {
  const passages = [];
  for (const e of entries) {
    const last = passages[passages.length - 1];
    if (last && last.book === e.abbrev && e.ch === last.to + 1) {
      last.to = e.ch;
    } else {
      passages.push({ book: e.abbrev, from: e.ch, to: e.ch });
    }
  }
  return passages;
}

function segLabel(pass) {
  const count = chapterCount.get(pass.book);
  if (count === 1) return pass.book; // single-chapter books: Oba, Phm, 2Jn, 3Jn, Jud
  if (pass.from === pass.to) return `${pass.book} ${pass.from}`;
  return `${pass.book} ${pass.from}–${pass.to}`;
}

function dayFromEntries(day, entries) {
  const passages = groupPassages(entries);
  const label = passages.map(segLabel).join("; ");
  return { day, label, passages };
}

function makeCanonicalPlan() {
  const all = OT_ORDER.concat(NT_ORDER);
  const days = [];
  let cursor = 0;
  for (let i = 0; i < 365; i++) {
    const take =
      Math.floor(((i + 1) * all.length) / 365) - Math.floor((i * all.length) / 365);
    days.push(dayFromEntries(i + 1, all.slice(cursor, cursor + take)));
    cursor += take;
  }
  return days;
}

function makeBlendedPlan() {
  const days = [];
  let otIdx = 0;
  let ntIdx = 0;
  const otRemainingStart = OT_ORDER.length;
  const ntRemainingStart = NT_ORDER.length;
  for (let i = 0; i < 365; i++) {
    const daysLeft = 365 - i;
    const otRemaining = otRemainingStart - otIdx;
    const ntRemaining = ntRemainingStart - ntIdx;
    const otTake = otRemaining > 0 ? Math.min(otRemaining, Math.max(1, Math.ceil(otRemaining / daysLeft))) : 0;
    const ntTake = ntRemaining > 0 ? Math.min(ntRemaining, Math.max(1, Math.ceil(ntRemaining / daysLeft))) : 0;
    const entries = OT_ORDER.slice(otIdx, otIdx + otTake).concat(NT_ORDER.slice(ntIdx, ntIdx + ntTake));
    days.push(dayFromEntries(i + 1, entries));
    otIdx += otTake;
    ntIdx += ntTake;
  }
  if (otIdx !== OT_ORDER.length || ntIdx !== NT_ORDER.length) {
    console.error(`Streams not fully consumed: OT ${otIdx}/${otRemainingStart}, NT ${ntIdx}/${ntRemainingStart}`);
    process.exit(1);
  }
  return days;
}

function verify(planName, days) {
  const problems = [];
  if (days.length !== 365) problems.push(`day count is ${days.length}, expected 365`);
  const seen = new Map();
  let total = 0;
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    if (d.day !== i + 1) problems.push(`day numbering broken at index ${i} (got ${d.day})`);
    if (!d.label || d.label.length === 0) problems.push(`day ${d.day} has empty label`);
    if (d.passages.length === 0) problems.push(`day ${d.day} has no passages`);
    for (const p of d.passages) {
      const max = chapterCount.get(p.book);
      if (!max) problems.push(`day ${d.day} references unknown book ${p.book}`);
      else if (!(p.from >= 1 && p.to >= p.from && p.to <= max))
        problems.push(`day ${d.day} passage ${p.book} ${p.from}-${p.to} out of range (book has ${max} chapters)`);
      for (let ch = p.from; ch <= p.to; ch++) {
        total++;
        const key = `${p.book}.${ch}`;
        seen.set(key, (seen.get(key) || 0) + 1);
      }
    }
  }
  let duplicates = 0;
  for (const [key, n] of seen) {
    if (n > 1) duplicates++;
  }
  if (total !== 1189) problems.push(`total chapters covered is ${total}, expected 1189`);
  if (seen.size !== 1189) problems.push(`unique chapters covered is ${seen.size}, expected 1189`);
  if (duplicates > 0) problems.push(`${duplicates} chapters appear more than once`);
  if (problems.length > 0) {
    console.error(`[${planName}] FAILED:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`[${planName}] OK: days=${days.length}, chapters covered=${total}, unique chapters=${seen.size}, duplicates=${duplicates} (1189/1189, every chapter exactly once)`);
  return days;
}

function buildPlan({ id, title, subtitle, description, accent }, days) {
  return { id, title, subtitle, description, accent, days };
}

const canonicalDays = verify("yearly-canonical", makeCanonicalPlan());
const blendedDays = verify("yearly-blended", makeBlendedPlan());

fs.mkdirSync(OUT_DIR, { recursive: true });

const canonical = buildPlan(
  {
    id: "yearly-canonical",
    title: "365 Days: Genesis to Revelation",
    subtitle: "The whole Bible in book order, a little every day",
    description:
      "Walk through all 66 books in canonical order, from Genesis 1 to Revelation 22. Most days carry three chapters and some four — roughly ten to fifteen minutes of reading. No devotionals, just the text itself: 1,189 chapters in one year, each read exactly once.",
    accent: "#C9A24B",
  },
  canonicalDays
);

const blended = buildPlan(
  {
    id: "yearly-blended",
    title: "The Bible in a Year: OT + NT Daily",
    subtitle: "An Old Testament and a New Testament portion every day",
    description:
      "Two streams in one year. Every day pairs an Old Testament portion with a New Testament portion, so you drink from both testaments daily until the streams run out together near the end of the year. 1,189 chapters in all, each read exactly once.",
    accent: "#5B8DB8",
  },
  blendedDays
);

fs.writeFileSync(
  path.join(OUT_DIR, "yearly-canonical.json"),
  JSON.stringify(canonical, null, 2) + "\n"
);
fs.writeFileSync(
  path.join(OUT_DIR, "yearly-blended.json"),
  JSON.stringify(blended, null, 2) + "\n"
);

console.log(`Wrote ${path.join(OUT_DIR, "yearly-canonical.json")} (${canonicalDays.length} days)`);
console.log(`Wrote ${path.join(OUT_DIR, "yearly-blended.json")} (${blendedDays.length} days)`);
