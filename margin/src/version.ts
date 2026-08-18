// Reads package.json once and exposes the package root. The compiled output
// lives in dist/src/, so the package root is two directories up from this
// file at runtime.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const PACKAGE_ROOT: string = join(__dirname, '..', '..');

export const VERSION: string = (
  JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as { version: string }
).version;
