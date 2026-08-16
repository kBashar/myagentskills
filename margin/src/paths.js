'use strict';

// Where margin keeps its state: $MARGIN_HOME when set (tests, sandboxes),
// otherwise ~/.margin. The directory holds daemon.json, journal.jsonl,
// daemon.log, and the daemon startup lock.
const path = require('node:path');

function marginHome() {
  if (process.env.MARGIN_HOME) return path.resolve(process.env.MARGIN_HOME);
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) throw new Error('cannot determine home directory; set MARGIN_HOME');
  return path.join(home, '.margin');
}

module.exports = { marginHome };
