// The daemon state file, <home>/daemon.json: port + token of the running (or
// most recent) daemon, so any CLI invocation can find and authenticate to it.
// The token is minted once on first run and persisted across restarts, so doc
// URLs already handed out keep working. The file is mode 0600 — it is the
// bearer secret for the daemon (ADR-0003).
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureHome } from './paths';

export interface DaemonState {
  v: number;
  port: number;
  token: string;
  pid?: number;
  startedAt?: string;
}

export function stateFile(home: string): string {
  return join(home, 'daemon.json');
}

export function readState(home: string): DaemonState | null {
  let raw: string;
  try {
    raw = readFileSync(stateFile(home), 'utf8');
  } catch {
    return null;
  }
  try {
    const s = JSON.parse(raw) as Partial<DaemonState> | null;
    if (s && typeof s.port === 'number' && typeof s.token === 'string' && s.token) {
      return s as DaemonState;
    }
  } catch {
    // fall through — a torn or foreign state file is treated as absent
  }
  return null;
}

export function writeState(home: string, s: DaemonState): void {
  ensureHome(home);
  const tmp = `${stateFile(home)}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(s, null, 2) + '\n', { mode: 0o600 });
  renameSync(tmp, stateFile(home));
}
