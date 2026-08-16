#!/usr/bin/env node
'use strict';

require('../src/cli')
  .main(process.argv.slice(2))
  .then((code) => process.exit(code == null ? 0 : code))
  .catch((err) => {
    process.stderr.write(`margin: ${err && err.message ? err.message : err}\n`);
    process.exit(1);
  });
