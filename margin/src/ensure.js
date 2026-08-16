'use strict';

// Idempotent daemon startup (ADR-0003: one global daemon per machine).
// `ensureDaemon` is safe for any agent to call at any time — it reports the
// healthy daemon recorded in the state file, or spawns exactly one. The
// spawned daemon serializes its own startup through the lock in lock.js, so
// concurrent ensures can never produce two daemons for the same home.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { readState } = require('./state');
const { request } = require('./http-client');

const START_TIMEOUT_MS = 8_000;
const PROBE_TIMEOUT_MS = 1_500;
const POLL_MS = 100;

// probe(home) → { port, token, pid } if a healthy margin daemon answers on
// the recorded port with the recorded token, else null.
async function probe(home) {
  const s = readState(home);
  if (!s) return null;
  try {
    const res = await request({
      port: s.port,
      path: `/healthz?t=${encodeURIComponent(s.token)}`,
      timeout: PROBE_TIMEOUT_MS,
    });
    if (res.status !== 200) return null;
    const body = JSON.parse(res.body.toString('utf8'));
    if (!body || body.service !== 'margin') return null;
    return { port: s.port, token: s.token, pid: typeof body.pid === 'number' ? body.pid : s.pid };
  } catch {
    return null;
  }
}

async function ensureDaemon(home) {
  const running = await probe(home);
  if (running) return { ...running, alreadyRunning: true };

  fs.mkdirSync(home, { recursive: true, mode: 0o700 });
  const logFile = path.join(home, 'daemon.log');
  const logFd = fs.openSync(logFile, 'a', 0o600);
  let child;
  try {
    child = spawn(process.execPath, [path.join(__dirname, '..', 'bin', 'margin.js'), 'serve'], {
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env: { ...process.env, MARGIN_HOME: home },
    });
  } finally {
    fs.closeSync(logFd);
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

module.exports = { ensureDaemon, probe };
