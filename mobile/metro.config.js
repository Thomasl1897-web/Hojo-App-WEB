const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite sur le web charge sa base depuis un module WebAssembly.
config.resolver.assetExts.push('wasm');

module.exports = config;
