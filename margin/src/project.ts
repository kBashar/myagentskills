// Project namespace (ADR-0003): the basename of the enclosing git worktree
// root — the nearest ancestor containing a `.git` entry (a directory in a
// regular clone, a pointer file in a worktree) — falling back to the cwd
// basename outside any repo. Pure metadata for namespacing and filtering.
import { existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

export function detectProject(cwd: string): string {
  const start = resolve(cwd);
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, '.git'))) return basename(dir);
    const parent = dirname(dir);
    if (parent === dir) return basename(start);
    dir = parent;
  }
}
