// metro.config.js
// Configured to prevent OOM crashes on large module graphs (1600+ modules).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ─── Memory Management ────────────────────────────────────────────────────────
// Cap the number of parallel transform workers.
// Default is (CPU count - 1); on multi-core machines this can exhaust RAM.
// 2 workers is a safe default for a ~1600-module bundle on 8–16 GB systems.
config.maxWorkers = 2;

// ─── Cache ────────────────────────────────────────────────────────────────────
// Keep the disk cache enabled so subsequent runs are fast.
// If you hit cache corruption issues, run: npm run start:clear
config.resetCache = false;

// ─── Resolver ─────────────────────────────────────────────────────────────────
// Preserve Expo's defaults and only append Node-style module extensions.
config.resolver.sourceExts = Array.from(new Set([
  ...config.resolver.sourceExts,
  'cjs',
  'mjs',
]));

module.exports = config;
