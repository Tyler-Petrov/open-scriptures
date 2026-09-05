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
        for (const span of spans.filter(s => s[2] === 1)) assert.equal(span[1], 0);
        for (const link of row.verses[vi].links.filter(l => l.supplied)) {
          assert.deepEqual(link.codes, []);
          assert.equal(link.sourceWordIds, undefined);
        }
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
  assert.deepEqual(linkedSpans(text, alignment), [["Word ", 0, 0], ["😀", ["G1"], 0], [" word", 0, 0]]);
  assert.equal(linkedSpans("Word 😀 Word", alignment), null);
  assert.equal(linkedSpans(text, { ...alignment, links: [{ ...alignment.links[0], end: 100 }] }), null);
  assert.deepEqual(linkedSpans(text, { ...alignment, links: [alignment.links[0], alignment.links[0]] }), linkedSpans(text, alignment));
  assert.equal(linkedSpans(text, null), null);
});

test("a separately supplied translation produces independent links and occurrences without storing its text", () => {
  const fixture = mkdtempSync(resolve(tmpdir(), "strongs-translation-"));
  try {
    writeFileSync(resolve(fixture, "Obadiah.json"), JSON.stringify({ book: "Oba", chapters: [[[ ["Different wording", "H1"] ]]] }));
    const alternate = prepareStrongs({ input: fixture, dictionary, translation: "NIV", source: "synthetic test fixture, not NIV text" });
    const row = alternate.strongsChapters[0];
    assert.equal(row.translation, "NIV");
    assert.deepEqual(linkedSpans("Different wording", row.verses[0])[0][1], ["H1"]);
    assert.equal(linkedSpans("KJV wording", row.verses[0]), null);
    assert.equal(JSON.stringify(row).includes("Different wording"), false);
    assert.deepEqual(alternate.strongsOccurrences, [{ translation: "NIV", code: "H1", keys: ["Oba.1.1"] }]);
    assert.throws(() => prepareStrongs({ input: fixture, dictionary, translation: "INVALID", source: "test" }));
  } finally { rmSync(fixture, { recursive: true }); }
});

test("overlapping, discontinuous links preserve every code and distinct source-word ID", () => {
  const text = "one two three";
  const sourceWords = [
    { id: "word1", codes: ["G1"], text: "α" },
    { id: "word2", codes: ["G2"], text: "β" },
    { id: "word3", codes: ["G1"], text: "α" },
  ];
  const alignment = {
    fingerprint: textFingerprint(text), sourceWords,
    links: [
      { start: 0, end: 7, codes: ["G1"], sourceWordIds: ["word1"], supplied: false },
      { start: 4, end: 7, codes: ["G2"], sourceWordIds: ["word2"], supplied: false },
      { start: 8, end: 13, codes: ["G1"], sourceWordIds: ["word1", "word3"], supplied: false },
    ],
  };
  assert.deepEqual(linkedSpans(text, alignment), [
    ["one ", ["G1"], 0], ["two", ["G1", "G2"], 0], [" ", 0, 0], ["three", ["G1"], 0],
  ]);
  const badId = structuredClone(alignment);
  badId.links[0].sourceWordIds = ["missing"];
  assert.equal(linkedSpans(text, badId), null);
  const wrongCode = structuredClone(alignment);
  wrongCode.links[0].codes = ["G3"];
  assert.equal(linkedSpans(text, wrongCode), null);
  const duplicateId = structuredClone(alignment);
  duplicateId.sourceWords.push(sourceWords[0]);
  assert.equal(linkedSpans(text, duplicateId), null);
});

test("rich source imports retain IDs, include every linked code once per verse, and omit translation text", () => {
  const fixture = mkdtempSync(resolve(tmpdir(), "strongs-rich-"));
  try {
    const verse = {
      text: "one two three",
      sourceWords: [{ id: "a", codes: ["G1"], text: "α", morphology: "N" }, { id: "b", codes: ["G2"] }],
      links: [{ start: 0, end: 7, sourceWordIds: ["a"] }, { start: 4, end: 13, sourceWordIds: ["a", "b"] }],
    };
    writeFileSync(resolve(fixture, "Obadiah.json"), JSON.stringify({ book: "Oba", chapters: [[verse]] }));
    const data = prepareStrongs({ input: fixture, dictionary, translation: "NIV", source: "synthetic fixture" });
    assert.deepEqual(data.strongsChapters[0].verses[0].sourceWords, verse.sourceWords);
    assert.equal(JSON.stringify(data).includes(verse.text), false);
    assert.deepEqual(data.strongsOccurrences, [
      { translation: "NIV", code: "G1", keys: ["Oba.1.1"] },
      { translation: "NIV", code: "G2", keys: ["Oba.1.1"] },
    ]);
    verse.links[0].sourceWordIds = ["nonexistent"];
    writeFileSync(resolve(fixture, "Obadiah.json"), JSON.stringify({ book: "Oba", chapters: [[verse]] }));
    assert.throws(() => prepareStrongs({ input: fixture, dictionary, translation: "NIV", source: "test" }));
  } finally { rmSync(fixture, { recursive: true }); }
});

test("old single-code server records remain readable during deployment", () => {
  const text = "a word";
  const spans = linkedSpans(text, { fingerprint: textFingerprint(text), links: [
    { start: 0, end: 1, code: null, supplied: true },
    { start: 2, end: 6, code: "G1", supplied: false },
  ] });
  assert.deepEqual(spans, [["a", 0, 1], [" ", 0, 0], ["word", ["G1"], 0]]);
});

test("supplied words override overlapping phrase links, including legacy records", () => {
  const text = "did understand";
  for (const tag of [{ code: "G3" }, { codes: ["G3", "G4"] }]) {
    const spans = linkedSpans(text, { fingerprint: textFingerprint(text), links: [
      { start: 0, end: text.length, codes: ["G1", "G2"], supplied: false },
      { start: 0, end: 3, ...tag, supplied: true },
    ] });
    assert.deepEqual(spans, [["did", 0, 1], [" understand", ["G1", "G2"], 0]]);
  }
});

test("imports remove supplied-word links and occurrences while preserving phrase source IDs", () => {
  const fixture = mkdtempSync(resolve(tmpdir(), "strongs-supplied-"));
  try {
    const verse = {
      text: "one added two",
      sourceWords: [{ id: "a", codes: ["G1", "G2"] }, { id: "b", codes: ["G3"] }],
      links: [
        { start: 0, end: 13, sourceWordIds: ["a"] },
        { start: 4, end: 9, sourceWordIds: ["b"], supplied: true },
      ],
    };
    const compact = [["supplied", ["H1", "H2"], 1], [" word", "H3"]];
    const write = () => writeFileSync(resolve(fixture, "Obadiah.json"), JSON.stringify({ book: "Oba", chapters: [[verse, compact]] }));
    write();
    const load = () => prepareStrongs({ input: fixture, dictionary, translation: "NIV", source: "synthetic fixture" });
    const data = load();
    const links = data.strongsChapters[0].verses[0].links;
    assert.deepEqual(links.filter(l => !l.supplied).map(l => [l.start, l.end, l.sourceWordIds]), [[0, 4, ["a"]], [9, 13, ["a"]]]);
    for (const alignment of data.strongsChapters[0].verses) {
      for (const link of alignment.links.filter(l => l.supplied)) {
        assert.deepEqual(link.codes, []);
        assert.equal(link.sourceWordIds, undefined);
      }
    }
    assert.deepEqual(data.strongsOccurrences.map(r => r.code), ["G1", "G2", "H3"]);
    assert.deepEqual(linkedSpans(verse.text, data.strongsChapters[0].verses[0]), [
      ["one ", ["G1", "G2"], 0], ["added", 0, 1], [" two", ["G1", "G2"], 0],
    ]);
    // Rich imports can mark supplied text without inventing an original word.
    verse.links[1].sourceWordIds = [];
    write();
    assert.deepEqual(load().strongsOccurrences, data.strongsOccurrences);
  } finally { rmSync(fixture, { recursive: true }); }
});
