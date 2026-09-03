// onnxruntime-react-native's build.gradle uses org.gradle.util.VersionNumber,
// removed in Gradle 8+. The guarded block only matters for RN < 0.71.
const fs = require("fs");
const p = "node_modules/onnxruntime-react-native/android/build.gradle";
if (fs.existsSync(p)) {
  let s = fs.readFileSync(p, "utf8");
  const block =
    /\n  if \(VersionNumber\.parse\(REACT_NATIVE_VERSION\) < VersionNumber\.parse\("0\.71"\)\) \{[\s\S]*?\n  \}\n/;
  if (block.test(s)) {
    s = s.replace(block, "\n");
    fs.writeFileSync(p, s);
    console.log("patched onnxruntime-react-native build.gradle");
  }
}
