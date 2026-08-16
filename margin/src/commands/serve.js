'use strict';

// `margin serve` — runs the daemon in the foreground. Idempotent: when a
// healthy daemon already answers on the recorded port, reports it and exits
// 0. The startup lock serializes probe→bind→record across processes, so
// concurrent starters converge on exactly one daemon per margin home.
const { startDaemon } = require('../daemon');
const { generateToken } = require('../auth');
const { readState, writeState } = require('../state');
const { acquireStartupLock } = require('../lock');
const { probe } = require('../ensure');

async function cmdServe(home) {
  let daemon = null;
  const lock = await acquireStartupLock(home);
  try {
    const running = await probe(home);
    if (running) {
      console.log(`margin daemon already running at http://127.0.0.1:${running.port} (pid ${running.pid})`);
      return 0;
    }

    const prev = readState(home);
    // The token is minted once and reused across restarts, so doc URLs that
    // were already printed keep working (ADR-0003).
    const token = prev && prev.token ? prev.token : generateToken();
    // Prefer the recorded port for the same reason; fall back to an
    // ephemeral one if a foreign process has taken it.
    const candidates = prev && typeof prev.port === 'number' ? [prev.port, 0] : [0];
    for (const port of candidates) {
      try {
        daemon = await startDaemon({ home, port, token });
        break;
      } catch (err) {
        if (err && err.code === 'EADDRINUSE') {
          console.error(`port ${port} is in use by another process; picking a fresh port`);
          continue;
        }
        throw err;
      }
    }
    if (!daemon) throw new Error('could not bind a port on 127.0.0.1');

    writeState(home, { v: 1, port: daemon.port, token, pid: process.pid, startedAt: new Date().toISOString() });
    console.log(`margin daemon serving at http://127.0.0.1:${daemon.port} (pid ${process.pid})`);
    console.log(`home: ${home}`);
  } finally {
    lock.release();
  }

  // Foreground: serve until signalled.
  await new Promise((resolve) => {
    process.once('SIGINT', resolve);
    process.once('SIGTERM', resolve);
  });
  await new Promise((resolve) => {
    daemon.server.close(resolve);
    if (typeof daemon.server.closeIdleConnections === 'function') daemon.server.closeIdleConnections();
  });
  return 0;
}

module.exports = { cmdServe };
