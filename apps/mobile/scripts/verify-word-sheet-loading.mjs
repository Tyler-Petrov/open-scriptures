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
  sheet.includes("useStrongsEntry(code)") && sheet.includes("useStrongsOccurrences(translation, code)"),
  "Word study and references must subscribe to server queries."
);
expect(
  sheet.includes("ActivityIndicator") && sheet.includes("Loading verse references"),
  "The references fallback must show a labeled native spinner."
);
expect(
  sheet.includes('state.status === "loading"') && sheet.includes('state.status === "error"'),
  "Server lookups must distinguish loading from errors."
);
expect(
  !sheet.includes("getOccurrences(code)"),
  "WordSheet must not run the occurrence lookup synchronously."
);
expect(
  !strongs.includes("assets/strongs") && strongs.includes("api.strongs.occurrences"),
  "The occurrence lookup must use Convex without loading bundled datasets."
);

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Word-sheet lookups use server queries with loading and error states.");
