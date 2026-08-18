#!/usr/bin/env node
'use strict';

// This shim runs the COMPILED output (ADR-0006): the source is TypeScript in
// src/, built to dist/ by `npm run build`. `typescript` is the sole
// devDependency; what `npx margin` installs has zero runtime dependencies.
let cli;
try {
  cli = require('../dist/src/cli');
} catch (err) {
  if (err && err.code === 'MODULE_NOT_FOUND') {
    process.stderr.write('margin: compiled output missing — run `npm run build` in the margin package first\n');
    process.exit(1);
  }
  throw err;
}

cli
  .main(process.argv.slice(2))
  .then((code) => process.exit(code == null ? 0 : code))
  .catch((err) => {
    process.stderr.write(`margin: ${err && err.message ? err.message : err}\n`);
    process.exit(1);
  });
