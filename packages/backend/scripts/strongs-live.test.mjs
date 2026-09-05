// Run after seeding an isolated local deployment; never contacts the app's cloud backend.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ConvexHttpClient } from "convex/browser";
import { readFileSync } from "node:fs";
import { linkedSpans } from "../../core/src/strongs.ts";

const client = new ConvexHttpClient("http://127.0.0.1:3210");

test("deployed queries serve migrated entries, exact word links, and ordered references", async () => {
  const chapter = await client.query("strongs:chapter", { translation: "KJV", book: "Gen", chapter: 1 });
  const original = JSON.parse(readFileSync(new URL("../data/strongs/KJV/Genesis.json", import.meta.url)));
  const text = original.chapters[0][0].map(s => s[0]).join("");
  const spans = linkedSpans(text, chapter.verses[0]);
  assert.equal(spans.map(s => s[0]).join(""), text);
  const code = spans.find(s => s[1])[1][0];
  const entry = await client.query("strongs:entry", { code });
  assert.ok(entry.o);
  const occurrences = await client.query("strongs:occurrences", { translation: "KJV", code });
  assert.ok(occurrences.includes("Gen.1.1"));
  assert.equal(new Set(occurrences).size, occurrences.length);
});

test("unseeded translations never receive KJV links or occurrences", async () => {
  for (const translation of ["NASB", "NIV", "NKJV", "ESV"]) {
    assert.equal(await client.query("strongs:chapter", { translation, book: "Gen", chapter: 1 }), null);
    assert.deepEqual(await client.query("strongs:occurrences", { translation, code: "H7225" }), []);
  }
});

test("deployed argument guards reject invalid references, translations, and codes", async () => {
  await assert.rejects(client.query("strongs:chapter", { translation: "KJV", book: "Gen", chapter: 0 }));
  await assert.rejects(client.query("strongs:chapter", { translation: "KJV", book: "Gen", chapter: 1.5 }));
  await assert.rejects(client.query("strongs:chapter", { translation: "INVALID", book: "Gen", chapter: 1 }));
  await assert.rejects(client.query("strongs:entry", { code: "../../anything" }));
  await assert.rejects(client.query("strongs:occurrences", { translation: "KJV", code: "" }));
  assert.equal(await client.query("strongs:entry", { code: "G99999" }), null);
});
