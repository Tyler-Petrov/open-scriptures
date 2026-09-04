// Node 22.18+ (native TypeScript stripping). Run from any working directory.
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { BOOKS } from "../../core/src/books.ts";
import { TRANSLATION_IDS } from "../../core/src/translations.ts";
import { linkedSpans, textFingerprint } from "../../core/src/strongs.ts";

const backend = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const codePattern = /^[GH][1-9][0-9]{0,4}[a-zA-Z]?$/;
const readJson = path => JSON.parse(readFileSync(path, "utf8"));

/** Accept only a translation's independently verified source spans. No projection
 * from KJV onto other translations. Output contains offsets, never verse text. */
export function prepareStrongs({ input, translation, source, dictionary }) {
  if (!TRANSLATION_IDS.includes(translation) || !source?.trim()) throw Error("Translation and alignment source are required.");
  const entries = Object.entries(readJson(dictionary)).map(([code, entry]) => {
    if (!codePattern.test(code) || !["Hebrew", "Greek", "Aramaic"].includes(entry.l) ||
      ["o", "t", "p", "d", "k", "r", "u", "pos"].some(field => typeof entry[field] !== "string")) throw Error(`Invalid dictionary entry ${code}`);
    return { code, entry };
  });
  const chapters = [];
  const occurrences = new Map();
  const books = new Map();
  for (const file of readdirSync(input).filter(f => f.endsWith(".json") && !["dict.json", "occurrences.json"].includes(f))) {
    const data = readJson(resolve(input, file));
    const book = BOOKS.find(b => b.abbrev === data.book);
    if (!book || books.has(data.book) || !Array.isArray(data.chapters) || data.chapters.length !== book.chapters) throw Error(`Invalid or duplicate book ${file}`);
    books.set(data.book, data);
  }
  if (!books.size) throw Error("No alignment books found.");
  for (const book of BOOKS) {
    const data = books.get(book.abbrev);
    if (!data) continue;
    data.chapters.forEach((verses, ci) => {
      if (!Array.isArray(verses) || verses.length > 200) throw Error(`Invalid chapter ${book.abbrev}.${ci + 1}`);
      const aligned = verses.map((spans, vi) => {
        if (spans === 0 || spans === null) return null;
        if (!Array.isArray(spans) || !spans.length) throw Error("Invalid verse spans");
        let text = "";
        const links = [];
        const seen = new Set();
        for (const span of spans) {
          if (!Array.isArray(span) || span.length < 2 || span.length > 3 || typeof span[0] !== "string" || !span[0].length ||
            (span[1] !== 0 && (typeof span[1] !== "string" || !codePattern.test(span[1]))) ||
            (span[2] !== undefined && span[2] !== 0 && span[2] !== 1)) throw Error("Invalid word span");
          const [word, code, supplied] = span;
          if (code || supplied) links.push({ start: text.length, end: text.length + word.length, code: code || null, supplied: supplied === 1 });
          text += word;
          if (code) seen.add(code);
        }
        const alignment = { fingerprint: textFingerprint(text), links };
        if (linkedSpans(text, alignment)?.map(s => s[0]).join("") !== text) throw Error("Alignment changed Scripture text");
        for (const code of seen) {
          const keys = occurrences.get(code) ?? [];
          keys.push(`${book.abbrev}.${ci + 1}.${vi + 1}`);
          occurrences.set(code, keys);
        }
        return alignment;
      });
      chapters.push({ translation, book: book.abbrev, chapter: ci + 1, source, verses: aligned });
    });
  }
  const documents = {
    strongsEntries: entries,
    strongsChapters: chapters,
    strongsOccurrences: [...occurrences].map(([code, keys]) => ({ translation, code, keys })),
  };
  for (const [table, rows] of Object.entries(documents)) {
    for (const row of rows) {
      // Reserve ample room for Convex serialization and system fields.
      if (Buffer.byteLength(JSON.stringify(row)) > 750_000) throw Error(`${table} document exceeds safe import size`);
    }
  }
  return documents;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: {
    translation: { type: "string", default: "KJV" }, input: { type: "string" },
    source: { type: "string" }, out: { type: "string", default: "/tmp/open-scripture-strongs" },
    import: { type: "boolean", default: false },
  } });
  if (values.translation !== "KJV" && (!values.input || !values.source)) throw Error("Other translations require --input and --source for their own verified alignments.");
  const documents = prepareStrongs({
    translation: values.translation,
    input: resolve(values.input ?? `${backend}/data/strongs/KJV`),
    source: values.source ?? "kaiserlik/kjv; aligned to aruljohn/Bible-kjv by build-strongs.py",
    dictionary: `${backend}/data/strongs/dict.json`,
  });
  mkdirSync(values.out, { recursive: true });
  for (const [table, rows] of Object.entries(documents)) {
    writeFileSync(resolve(values.out, `${table}.jsonl`), rows.map(row => JSON.stringify(row)).join("\n") + "\n");
    console.log(`${table}: ${rows.length} documents`);
  }
  if (values.import) {
    const run = args => execFileSync("npx", ["convex", ...args], { cwd: backend, encoding: "utf8" });
    const status = JSON.parse(run(["run", "strongs:importStatus", JSON.stringify({ translation: values.translation })]));
    if (status.chapters || status.occurrences) throw Error("This translation already has Strong's data. Refusing to append duplicates; inspect the deployment before updating it.");
    for (const table of Object.keys(documents)) {
      if (table === "strongsEntries" && status.dictionary) continue;
      console.log(run(["import", "--append", "--table", table, resolve(values.out, `${table}.jsonl`)]));
    }
  }
}
