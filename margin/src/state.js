'use strict';

// The daemon state file, <home>/daemon.json: port + token of the running (or
// most recent) daemon, so any CLI invocation can find and authenticate to it.
// The token is minted once on first run and persisted across restarts, so doc
// URLs already handed out keep working. The file is mode 0600 — it is the
// bearer secret for the daemon (ADR-0003).
const fs = require('node:fs');
const path = require('node:path');

function stateFile(home) {
  return path.join(home, 'daemon.json');
}

function readState(home) {
  let raw;
  try {
    raw = fs.readFileSync(stateFile(home), 'utf8');
  } catch {
    return null;
  }
  try {
    const s = JSON.parse(raw);
    if (s && typeof s.port === 'number' && typeof s.token === 'string' && s.token) return s;
  } catch {
    // fall through — a torn or foreign state file is treated as absent
  }
  return null;
}

function writeState(home, s) {
  fs.mkdirSync(home, { recursive: true, mode: 0o700 });
  const tmp = `${stateFile(home)}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, stateFile(home));
}

module.exports = { stateFile, readState, writeState };
