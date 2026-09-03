import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (file) => readFileSync(join(root, file), "utf8");
const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const ui = read("src/components/ui.tsx");
const layout = read("src/app/_layout.tsx");
const tabs = read("src/app/(tabs)/_layout.tsx");
const theme = read("src/lib/theme.tsx");
const planDetail = read("src/app/plans/[id].tsx");
const planDay = read("src/app/plans/[id]/day/[day].tsx");
const sheet = read("src/components/sheet-modal.tsx");
const wordSheet = read("src/components/word-sheet.tsx");
const verseSheet = read("src/components/verse-sheet.tsx");

expect(
  ui.includes('@expo/ui/community/segmented-control'),
  "Segmented must wrap Expo UI's native segmented control."
);
expect(!ui.includes("styles.segment,"), "Segmented must not render hand-built segment buttons.");
expect(!ui.includes("export function Header"), "The hand-built navigation header must be removed.");
expect(
  /name="plans\/\[id\]"\s+options=\{\{\s*headerShown:\s*true/.test(layout),
  "Plan detail must enable the native stack header."
);
expect(
  /name="plans\/\[id\]\/day\/\[day\]"\s+options=\{\{\s*headerShown:\s*true/.test(layout),
  "Plan day must enable the native stack header."
);
expect(planDetail.includes("<Stack.Screen"), "Plan detail must set its native title dynamically.");
expect(planDay.includes("<Stack.Screen"), "Plan day must set its native title dynamically.");
expect(!planDetail.includes("<Header"), "Plan detail must not render the custom header.");
expect(!planDay.includes("<Header"), "Plan day must not render the custom header.");
expect(
  sheet.includes("enablePanDownToClose"),
  "Sheet dismissal must keep Android Back enabled in Expo's universal wrapper."
);
expect(
  wordSheet.includes('Collapsible') && wordSheet.includes('from "@expo/ui"'),
  "Word references must use Expo UI's native Collapsible."
);
expect(!wordSheet.includes("occChip"), "Word references must not return to pill controls.");
expect(
  wordSheet.includes("seedColor={c.card}"),
  "Word-reference collapsibles must inherit the app card palette."
);
expect(
  tabs.includes("tabBarActiveTintColor: c.blue"),
  "The active tab must use the app's blue navigation accent."
);
expect(
  tabs.includes("android_ripple: _androidRipple") && tabs.includes("pressed && styles.tabPressed"),
  "The tab button must replace Android's oversized borderless ripple with restrained feedback."
);
expect(
  /blue:\s*"#[0-9A-Fa-f]{6}"/.test(theme),
  "The shared palette must define the blue navigation accent."
);
expect(
  /Alert\.alert\(\s*"Remove highlight\?"/.test(verseSheet) &&
    verseSheet.includes("confirmRemoveHighlight"),
  "Removing a highlight must require a native confirmation action."
);

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Native UI replacements verified; sheet Back dismissal remains enabled.");
