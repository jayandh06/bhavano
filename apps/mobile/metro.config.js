const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The monorepo root is watched, and a local web/admin build (the deploy script's docker build, or
// `next build`) leaves `.next/standalone` trees with paths Windows cannot lstat. The file watcher
// then throws and Metro dies mid-session. Nothing under a `.next` folder is ever app code.
config.resolver.blockList = [].concat(config.resolver.blockList ?? [], /[\\/]\.next[\\/].*/);

module.exports = config;
