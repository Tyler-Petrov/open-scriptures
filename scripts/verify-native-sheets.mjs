import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (file) => readFileSync(join(root, file), "utf8");

const modal = read("src/components/sheet-modal.tsx");
const sheets = [
  "src/components/book-sheet.tsx",
  "src/components/verse-sheet.tsx",
  "src/components/word-sheet.tsx",
  "src/components/display-sheet.tsx",
].map((file) => [file, read(file)]);

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

expect(
  modal.includes('@expo/ui/community/bottom-sheet'),
  "SheetModal must use Expo UI's native bottom sheet."
);
expect(modal.includes("enablePanDownToClose"), "Native pan-down dismissal must stay enabled.");
expect(!/\bModal\b/.test(modal), "SheetModal must not fall back to React Native Modal.");

for (const [file, source] of sheets) {
  expect(!source.includes("styles.backdrop"), `${file} must not render its own moving scrim.`);
  expect(!source.includes("styles.handle"), `${file} must not render a fake drag handle.`);
}

for (const [file, source] of sheets.slice(0, 3)) {
  expect(source.includes("SheetScrollView"), `${file} must use the sheet-aware scroll view.`);
}

const verse = read("src/components/verse-sheet.tsx");
expect(!verse.includes("Keyboard.addListener"), "VerseSheet must not manually lift a translucent modal.");

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Native sheet structure verified.");
