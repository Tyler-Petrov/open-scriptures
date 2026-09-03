import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (file) => readFileSync(join(root, file), "utf8");
const sheet = read("src/components/word-sheet.tsx");
const strongs = read("src/lib/strongs.ts");
const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

expect(
  sheet.includes("Suspense") && sheet.includes("fallback={<WordReferencesFallback"),
  "Word references must render behind a Suspense fallback."
);
expect(
  sheet.includes("ActivityIndicator") && sheet.includes("Loading verse references"),
  "The references fallback must show a labeled native spinner."
);
expect(
  sheet.includes("use(getOccurrencesAsync(code))"),
  "The reference component must suspend on the occurrence lookup."
);
expect(
  !sheet.includes("getOccurrences(code)"),
  "WordSheet must not run the occurrence lookup synchronously."
);
expect(
  strongs.includes("export function getOccurrencesAsync") && strongs.includes("setTimeout"),
  "The occurrence lookup must yield before loading and cache its Promise."
);

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Word-sheet content renders before its deferred verse references.");
