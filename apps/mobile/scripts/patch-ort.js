// onnxruntime-react-native's build.gradle uses org.gradle.util.VersionNumber,
// removed in Gradle 8+. The guarded block only matters for RN < 0.71.
// Resolved through require so it works wherever the workspace hoists it.
const fs = require("fs");
const path = require("path");
let p;
try {
  p = path.join(
    path.dirname(require.resolve("onnxruntime-react-native/package.json", { paths: [__dirname] })),
    "android/build.gradle"
  );
} catch {
  p = null;
}
if (p && fs.existsSync(p)) {
  let s = fs.readFileSync(p, "utf8");
  const block =
    /\n  if \(VersionNumber\.parse\(REACT_NATIVE_VERSION\) < VersionNumber\.parse\("0\.71"\)\) \{[\s\S]*?\n  \}\n/;
  if (block.test(s)) {
    s = s.replace(block, "\n");
    fs.writeFileSync(p, s);
    console.log("patched onnxruntime-react-native build.gradle");
  }
}
