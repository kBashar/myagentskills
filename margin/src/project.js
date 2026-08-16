'use strict';

// Project namespace (ADR-0003): the basename of the enclosing git worktree
// root — the nearest ancestor containing a `.git` entry (a directory in a
// regular clone, a pointer file in a worktree) — falling back to the cwd
// basename outside any repo. Pure metadata for namespacing and filtering.
const fs = require('node:fs');
const path = require('node:path');

function detectProject(cwd) {
  const start = path.resolve(cwd);
  let dir = start;
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git'))) return path.basename(dir);
    const parent = path.dirname(dir);
    if (parent === dir) return path.basename(start);
    dir = parent;
  }
}

module.exports = { detectProject };
