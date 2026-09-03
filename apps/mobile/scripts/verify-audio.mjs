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

const manifestPath = path.join(repo, "android/app/src/main/AndroidManifest.xml");
if (fs.existsSync(manifestPath)) {
  const manifest = fs.readFileSync(manifestPath, "utf8");
  for (const required of [
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
    "expo.modules.audio.service.AudioControlsService",
    'android:foregroundServiceType="mediaPlayback"',
  ]) {
    assert.ok(manifest.includes(required), `Android manifest is missing ${required}`);
  }
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
assert.ok(reader.includes("useBookTimings"), "the reader must load timing data from Convex");
assert.ok(reader.includes("getChapterTiming(bookTimings"), "the reader must use loaded timing data");

const timings = read("src/lib/timings.ts");
assert.ok(timings.includes("api.timings.forBook"), "timings must use the Convex forBook query");
assert.ok(!timings.includes("src/assets/timings"), "timings must not load bundled JSON");

console.log("Audio verified: background playback and Convex timing integration");
