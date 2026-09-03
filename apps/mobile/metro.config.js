const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
// On-device semantic search assets: int8 ONNX encoder + packed verse vectors.
config.resolver.assetExts.push("onnx", "bin");

module.exports = config;
