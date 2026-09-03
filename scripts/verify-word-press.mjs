import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const source = readFileSync(join(root, "src/app/(tabs)/read.tsx"), "utf8");
const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

expect(
  source.includes("const WORD_PRESS_DELAY_MS = 500;"),
  "Word holds must use an explicit 500ms opening delay."
);
expect(
  /onPressIn:\s*\(\)\s*=>\s*beginWordPress\(String\(code\),\s*t\)/.test(source),
  "A native word hold must start when the finger goes down."
);
expect(
  /onPressOut:\s*cancelWordPress/.test(source),
  "Releasing before the delay must cancel the pending word sheet."
);
expect(
  !source.includes("onLongPress:"),
  "Native word opening must not wait for React Native's nested Text long-press callback."
);
expect(
  source.includes("wordPressOpenedRef.current"),
  "A completed hold must suppress the normal tap action on release."
);

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Word hold opens on its timer and cancels cleanly on early release.");
