// Idempotent daemon startup (ADR-0003: one global daemon per machine).
// `ensureDaemon` is safe for any agent to call at any time — it reports the
// healthy daemon recorded in the state file, or spawns exactly one. The
// spawned daemon serializes its own startup through the lock in lock.ts, so
// concurrent ensures can never produce two daemons for the same home.
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { readState } from './state';
import { request } from './http-client';
import { PACKAGE_ROOT } from './version';

const START_TIMEOUT_MS = 8_000;
const PROBE_TIMEOUT_MS = 1_500;
const POLL_MS = 100;

export interface DaemonInfo {
  port: number;
  token: string;
  pid: number | undefined;
}

// probe(home) → the recorded daemon's coordinates if a healthy margin daemon
// answers on the recorded port with the recorded token, else null. The token
// rides the Authorization header; token-scoped URLs (?t=…) are built only by
// the auth module, for browser-bound URLs.
export async function probe(home: string): Promise<DaemonInfo | null> {
  const s = readState(home);
  if (!s) return null;
  try {
    const res = await request({ port: s.port, path: '/healthz', token: s.token, timeout: PROBE_TIMEOUT_MS });
    if (res.status !== 200) return null;
    const body = JSON.parse(res.body.toString('utf8')) as { service?: string; pid?: number };
    if (!body || body.service !== 'margin') return null;
    return { port: s.port, token: s.token, pid: typeof body.pid === 'number' ? body.pid : s.pid };
  } catch {
    return null;
  }
}

export async function ensureDaemon(home: string): Promise<DaemonInfo & { alreadyRunning: boolean }> {
  const running = await probe(home);
  if (running) return { ...running, alreadyRunning: true };

  mkdirSync(home, { recursive: true, mode: 0o700 });
  const logFile = join(home, 'daemon.log');
  const logFd = openSync(logFile, 'a', 0o600);
  let child;
  try {
    // The bin shim runs the compiled output (ADR-0006).
    child = spawn(process.execPath, [join(PACKAGE_ROOT, 'bin', 'margin.js'), 'serve'], {
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env: { ...process.env, MARGIN_HOME: home },
    });
  } finally {
    closeSync(logFd);
  }
  child.unref();

  const deadline = Date.now() + START_TIMEOUT_MS;
  for (;;) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const up = await probe(home);
    if (up) return { ...up, alreadyRunning: false };
    if (Date.now() > deadline) {
      throw new Error(`daemon did not start within ${START_TIMEOUT_MS / 1000}s — see ${logFile}`);
    }
  }
}
