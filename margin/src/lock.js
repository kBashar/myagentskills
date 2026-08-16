'use strict';

// Startup lock: serializes the probe→bind→record sequence of daemon startup
// so two concurrent `margin serve` invocations (e.g. two agents racing
// `serve --ensure`) can never bind two daemons for the same margin home.
// mkdir is atomic on POSIX; a lock abandoned mid-startup goes stale and is
// broken after STALE_MS.
const fs = require('node:fs');
const path = require('node:path');

const STALE_MS = 30_000;

async function acquireStartupLock(home, { timeoutMs = 10_000 } = {}) {
  fs.mkdirSync(home, { recursive: true, mode: 0o700 });
  const dir = path.join(home, 'daemon.lock');
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      fs.mkdirSync(dir, 0o700);
      fs.writeFileSync(path.join(dir, 'pid'), `${process.pid}\n`, { mode: 0o600 });
      return {
        release() {
          try {
            fs.rmSync(dir, { recursive: true, force: true });
          } catch {
            // best effort — a leftover lock goes stale and gets broken
          }
        },
      };
    } catch (err) {
      if (!err || err.code !== 'EEXIST') throw err;
      try {
        const st = fs.statSync(dir);
        if (Date.now() - st.mtimeMs > STALE_MS) {
          fs.rmSync(dir, { recursive: true, force: true });
          continue;
        }
      } catch {
        continue; // the lock vanished between checks — retry
      }
      if (Date.now() > deadline) throw new Error('timed out waiting for the daemon startup lock');
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

module.exports = { acquireStartupLock };
