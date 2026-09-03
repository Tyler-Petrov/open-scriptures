import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(repo, relative), "utf8");

const appConfig = JSON.parse(read("app.json"));
const audioPlugin = appConfig.expo.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === "expo-audio"
);
assert.equal(
  audioPlugin?.[1]?.enableBackgroundPlayback,
  true,
  "app.json must enable expo-audio background playback"
);

const manifest = read("android/app/src/main/AndroidManifest.xml");
for (const required of [
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
  "expo.modules.audio.service.AudioControlsService",
  'android:foregroundServiceType="mediaPlayback"',
]) {
  assert.ok(manifest.includes(required), `Android manifest is missing ${required}`);
}

const layout = read("src/app/_layout.tsx");
assert.ok(
  layout.includes("shouldPlayInBackground: true"),
  "the runtime audio session must allow background playback"
);
assert.ok(
  layout.includes('interruptionMode: "doNotMix"'),
  "the runtime audio session must request audio focus for lock-screen controls"
);

const reader = read("src/app/(tabs)/read.tsx");
assert.ok(
  reader.includes("setActiveForLockScreen(true"),
  "the active player must register Android lock-screen controls"
);

const bibleDir = path.join(repo, "src/assets/bible");
const timingDir = path.join(repo, "src/assets/timings");
const books = fs.readdirSync(bibleDir).filter((name) => name.endsWith(".json"));
let chapterCount = 0;
let verseCount = 0;

for (const filename of books) {
  const bible = JSON.parse(fs.readFileSync(path.join(bibleDir, filename), "utf8"));
  const timings = JSON.parse(fs.readFileSync(path.join(timingDir, filename), "utf8"));
  for (let index = 0; index < bible.chapters.length; index += 1) {
    const verses = bible.chapters[index];
    const timing = timings.chapters[String(index + 1)];
    assert.ok(timing, `${filename} chapter ${index + 1} has no audio timing`);
    assert.equal(
      timing.verses.length,
      verses.length,
      `${filename} chapter ${index + 1} has incomplete verse timings`
    );
    assert.ok(timing.url.startsWith("https://"), `${filename} chapter ${index + 1} has no audio URL`);
    assert.ok(timing.end > timing.start, `${filename} chapter ${index + 1} has an invalid range`);
    for (let verse = 1; verse < timing.verses.length; verse += 1) {
      assert.ok(
        timing.verses[verse] > timing.verses[verse - 1],
        `${filename} chapter ${index + 1} verse timings are not increasing`
      );
    }
    chapterCount += 1;
    verseCount += verses.length;
  }
}

assert.equal(books.length, 66, "expected all 66 Bible books");
assert.equal(chapterCount, 1189, "expected all 1,189 Bible chapters");
assert.equal(verseCount, 31102, "expected all 31,102 KJV verses");

console.log(`Audio verified: ${books.length} books, ${chapterCount} chapters, ${verseCount} verses`);
