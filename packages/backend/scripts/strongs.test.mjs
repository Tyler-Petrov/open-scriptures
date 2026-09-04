import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { prepareStrongs } from "./import-strongs.mjs";
import { linkedSpans, textFingerprint } from "../../core/src/strongs.ts";
import { BOOKS } from "../../core/src/books.ts";

const input = new URL("../data/strongs/KJV/", import.meta.url).pathname;
const dictionary = new URL("../data/strongs/dict.json", import.meta.url).pathname;
const documents = prepareStrongs({ input, dictionary, translation: "KJV", source: "test" });

test("every migrated verse preserves the exact source text, codes, and italics", () => {
  let matched = 0;
  const keys = [];
  for (const book of BOOKS) {
    const data = JSON.parse(readFileSync(resolve(input, `${book.name.replaceAll(" ", "")}.json`)));
    data.chapters.forEach((verses, ci) => {
      const row = documents.strongsChapters.find(c => c.book === book.abbrev && c.chapter === ci + 1);
      assert.ok(row);
      verses.forEach((spans, vi) => {
        keys.push(`${book.abbrev}.${ci + 1}.${vi + 1}`);
        if (spans === 0) { assert.equal(row.verses[vi], null); return; }
        const text = spans.map(s => s[0]).join("");
        const rendered = linkedSpans(text, row.verses[vi]);
        assert.equal(rendered.map(s => s[0]).join(""), text);
        assert.deepEqual(rendered.filter(s => s[1] || s[2]).map(s => [s[0], s[1], s[2] || 0]), spans.filter(s => s[1] || s[2]).map(s => [s[0], s[1], s[2] || 0]));
        assert.equal(linkedSpans(text + "!", row.verses[vi]), null);
        matched++;
      });
    });
  }
  assert.equal(documents.strongsChapters.length, 1189);
  assert.ok(matched > 28000);
  const legacy = JSON.parse(readFileSync(resolve(input, "occurrences.json")));
  assert.equal(documents.strongsOccurrences.length, Object.keys(legacy).length);
  for (const row of documents.strongsOccurrences) {
    assert.deepEqual(row.keys, legacy[row.code].map(i => keys[i]));
    assert.equal(row.translation, "KJV");
  }
});

test("changed text and invalid offsets cannot display links", () => {
  const text = "Word 😀 word";
  const alignment = { fingerprint: textFingerprint(text), links: [{ start: 5, end: 7, code: "G1", supplied: false }] };
  assert.deepEqual(linkedSpans(text, alignment), [["Word ", 0], ["😀", "G1", 0], [" word", 0]]);
  assert.equal(linkedSpans("Word 😀 Word", alignment), null);
  assert.equal(linkedSpans(text, { ...alignment, links: [{ ...alignment.links[0], end: 100 }] }), null);
  assert.equal(linkedSpans(text, { ...alignment, links: [alignment.links[0], alignment.links[0]] }), null);
  assert.equal(linkedSpans(text, null), null);
});

test("a separately supplied translation produces independent links and occurrences without storing its text", () => {
  const fixture = mkdtempSync(resolve(tmpdir(), "strongs-translation-"));
  try {
    writeFileSync(resolve(fixture, "Obadiah.json"), JSON.stringify({ book: "Oba", chapters: [[[ ["Different wording", "H1"] ]]] }));
    const alternate = prepareStrongs({ input: fixture, dictionary, translation: "NIV", source: "synthetic test fixture, not NIV text" });
    const row = alternate.strongsChapters[0];
    assert.equal(row.translation, "NIV");
    assert.equal(linkedSpans("Different wording", row.verses[0])[0][1], "H1");
    assert.equal(linkedSpans("KJV wording", row.verses[0]), null);
    assert.equal(JSON.stringify(row).includes("Different wording"), false);
    assert.deepEqual(alternate.strongsOccurrences, [{ translation: "NIV", code: "H1", keys: ["Oba.1.1"] }]);
    assert.throws(() => prepareStrongs({ input: fixture, dictionary, translation: "INVALID", source: "test" }));
  } finally { rmSync(fixture, { recursive: true }); }
});
