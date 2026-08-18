// Where margin keeps its state: $MARGIN_HOME when set (tests, sandboxes),
// otherwise ~/.margin. The directory holds daemon.json, journal.jsonl,
// daemon.log, and the daemon startup lock.
import { resolve } from 'node:path';

export function marginHome(): string {
  if (process.env.MARGIN_HOME) return resolve(process.env.MARGIN_HOME);
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) throw new Error('cannot determine home directory; set MARGIN_HOME');
  return resolve(home, '.margin');
}
