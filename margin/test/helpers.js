'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { startDaemon } = require('../src/daemon');

const TEST_TOKEN = 'test-token';

function tmpdir(t, prefix = 'margin-test-') {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', prefix));
  t.after(() => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best effort
    }
  });
  return dir;
}

// A throwaway margin home for tests that spawn real daemons via the CLI.
// One t.after hook kills the daemon first and removes the directory second —
// separate hooks would run in registration order and could delete the state
// file before the pid is read.
function daemonHome(t) {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'margin-home-'));
  t.after(() => {
    try {
      const s = JSON.parse(fs.readFileSync(path.join(dir, 'daemon.json'), 'utf8'));
      if (s && s.pid) process.kill(s.pid);
    } catch {
      // no daemon recorded — nothing to kill
    }
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best effort
    }
  });
  return dir;
}

// The project's one test seam: a real daemon on an ephemeral port, driven
// over HTTP. `home` is a throwaway margin home (journal included).
async function testDaemon(t, { token = TEST_TOKEN, home = null } = {}) {
  const h = home || tmpdir(t);
  const d = await startDaemon({ home: h, port: 0, token });
  t.after(
    () =>
      new Promise((resolve) => {
        d.server.close(() => resolve());
        if (typeof d.server.closeIdleConnections === 'function') d.server.closeIdleConnections();
      })
  );
  return { home: h, port: d.port, token, server: d.server, ctx: d.ctx };
}

module.exports = { TEST_TOKEN, tmpdir, daemonHome, testDaemon };
