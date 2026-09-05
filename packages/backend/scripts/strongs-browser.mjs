// Requires Playwright and the seeded local backend. No production endpoints are used.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const dir = resolve(process.env.STRONGS_EVIDENCE_DIR ?? "/tmp/strongs-multi-evidence");
mkdirSync(dir, { recursive: true });
const client = new ConvexHttpClient("http://127.0.0.1:3210");
const codes = ["H1254", "H853"];
const expected = await Promise.all(codes.map(async code => ({
  code,
  entry: await client.query("strongs:entry", { code }),
  occurrences: await client.query("strongs:occurrences", { translation: "KJV", code }),
})));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 412, height: 915 }, recordVideo: { dir, size: { width: 412, height: 915 } } });
const errors = [];
try {
  await context.addInitScript(() => localStorage.setItem("openscripture.settings", JSON.stringify({ theme: "light", fontSize: 18, onboarded: true, translation: "KJV" })));
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://localhost:8082/read");
  const word = page.locator("[data-scode]").filter({ hasText: /^created$/ }).first();
  await word.waitFor({ timeout: 30000 });
  assert.deepEqual(JSON.parse(await word.getAttribute("data-scode")), codes);
  // The tuple's presence must not make ordinary words italic.
  assert.equal(await word.evaluate(el => getComputedStyle(el).fontStyle), "normal");
  await page.screenshot({ path: `${dir}/reader.png` });
  const box = await word.boundingBox();
  assert.ok(box);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await page.getByRole("button", { name: "Study H853", exact: true }).waitFor();
  for (const result of expected) {
    await page.getByRole("button", { name: `Study ${result.code}`, exact: true }).click();
    await page.getByText(result.entry.o, { exact: true }).waitFor();
    const count = result.occurrences.length.toLocaleString("en-US");
    await page.getByText(new RegExp(`Linked in ${count} verses across`)).waitFor();
    const other = expected.find(e => e.code !== result.code);
    assert.equal(await page.getByText(other.entry.o, { exact: true }).count(), 0);
    await page.screenshot({ path: `${dir}/created-${result.code.toLowerCase()}.png` });
    console.log(`${result.code}: correct definition and ${count} verse references`);
    await page.waitForTimeout(900);
  }
  const genCount = expected[1].occurrences.filter(key => key.startsWith("Gen.")).length;
  await page.getByText(`Genesis · ${genCount} verses`, { exact: true }).click();
  await page.getByRole("link", { name: "Genesis 1:1", exact: true }).click();
  await page.getByRole("button", { name: "Study H853", exact: true }).waitFor({ state: "hidden" });
  assert.deepEqual(errors, []);
  await context.close();
  console.log(`Recording: ${await page.video().path()}`);
  console.log("Word selection, reference navigation, unchanged text styling, and sheet dismissal passed.");
} finally { await browser.close(); }
