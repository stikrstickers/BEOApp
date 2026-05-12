#!/usr/bin/env node
// Postinstall hardening: react-native-reanimated 4 + moti's framer-motion peer
// dep make npm nest a duplicate `react` inside `node_modules/moti`. Two React
// instances = "Invalid hook call. Hooks can only be called inside of the body
// of a function component." The npm `overrides` block in package.json *should*
// fix this, but framer-motion@6.5.1's strict peer (react@<=18) keeps winning.
//
// Until we can drop moti or upgrade framer-motion: this script wipes any
// nested react/react-dom copies after every install.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'node_modules');
const PACKAGES_TO_DEDUPE = ['react', 'react-dom'];

function walk(dir, depth = 0) {
  if (depth > 6) return;  // safety
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const full = path.join(dir, ent.name);
    if (ent.name === 'node_modules') {
      // We're sitting at <pkg>/node_modules — inspect its children.
      for (const child of fs.readdirSync(full, { withFileTypes: true })) {
        if (child.isDirectory() && PACKAGES_TO_DEDUPE.includes(child.name)) {
          const dupe = path.join(full, child.name);
          try {
            fs.rmSync(dupe, { recursive: true, force: true });
            console.log(`[dedupe-react] removed nested ${path.relative(ROOT, dupe)}`);
          } catch (e) {
            console.warn(`[dedupe-react] failed to remove ${dupe}: ${e.message}`);
          }
        }
      }
    } else {
      walk(full, depth + 1);
    }
  }
}

if (fs.existsSync(ROOT)) {
  walk(ROOT);
} else {
  console.log('[dedupe-react] no node_modules yet, skipping');
}
