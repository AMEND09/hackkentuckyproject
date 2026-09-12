const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);
const liveActivity = path.resolve(__dirname, "modules/dart-live-activity");

config.watchFolders = [...(config.watchFolders || []), liveActivity];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "dart-live-activity": liveActivity,
};

module.exports = config;
