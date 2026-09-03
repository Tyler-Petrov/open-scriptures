// Keep the installed onnxruntime-react-native package compatible with the
// Android toolchain used by this Expo project. Resolve through require so this
// works wherever the workspace hoists the package.
const fs = require("fs");
const path = require("path");
let packageDir;
try {
  packageDir = path.dirname(
    require.resolve("onnxruntime-react-native/package.json", { paths: [__dirname] })
  );
} catch {
  packageDir = null;
}

const gradlePath = packageDir && path.join(packageDir, "android/build.gradle");
if (gradlePath && fs.existsSync(gradlePath)) {
  let s = fs.readFileSync(gradlePath, "utf8");
  const block =
    /\n  if \(VersionNumber\.parse\(REACT_NATIVE_VERSION\) < VersionNumber\.parse\("0\.71"\)\) \{[\s\S]*?\n  \}\n/;
  if (block.test(s)) {
    s = s.replace(block, "\n");
    fs.writeFileSync(gradlePath, s);
    console.log("patched onnxruntime-react-native build.gradle");
  }
}

// Expo SDK 57 uses NDK r27. Android requires both flags for 16 KB ELF LOAD
// alignment on NDK r27 and lower. The upstream React Native adapter does not
// currently set them for its locally compiled libonnxruntimejsi.so.
if (packageDir) {
  const cmakePath = path.join(packageDir, "android/CMakeLists.txt");
  if (!fs.existsSync(cmakePath)) {
    throw new Error("onnxruntime-react-native android/CMakeLists.txt is missing");
  }

  let s = fs.readFileSync(cmakePath, "utf8");
  const anchor = "set(CMAKE_CXX_STANDARD 17)";
  const requiredLinkerFlags = [
    "-Wl,-z,max-page-size=16384",
    "-Wl,-z,common-page-size=16384",
  ];
  const missingLinkerFlags = requiredLinkerFlags.filter((flag) => !s.includes(flag));
  const pageSizeBlock = `

# Android 16 KB page-size support for NDK r27 and lower.
if(ANDROID)
  set(CMAKE_SHARED_LINKER_FLAGS "\${CMAKE_SHARED_LINKER_FLAGS} ${missingLinkerFlags.join(" ")}")
endif()`;

  if (missingLinkerFlags.length > 0) {
    if (!s.includes(anchor)) {
      throw new Error("onnxruntime-react-native CMakeLists.txt layout changed");
    }
    s = s.replace(anchor, `${anchor}${pageSizeBlock}`);
    fs.writeFileSync(cmakePath, s);
    console.log("patched onnxruntime-react-native for Android 16 KB page sizes");
  }
}
