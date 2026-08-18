// Where margin keeps its state: $MARGIN_HOME when set (tests, sandboxes),
// otherwise ~/.margin. The directory holds daemon.json, journal.jsonl,
// daemon.log, and the daemon startup lock.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export function marginHome(): string {
  if (process.env.MARGIN_HOME) return resolve(process.env.MARGIN_HOME);
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) throw new Error('cannot determine home directory; set MARGIN_HOME');
  return resolve(home, '.margin');
}

// The one "home exists, mode 0700" rule — every file writer goes through here
// before touching the state directory.
export function ensureHome(home: string): void {
  mkdirSync(home, { recursive: true, mode: 0o700 });
}
