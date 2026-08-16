'use strict';

// The journal (CONTEXT.md): an append-only JSONL record and the source of
// truth. The daemon is the only process that appends to it; the doc registry
// is derived by replaying it, so crashes never lose state. Later tickets add
// annotation and status-change event types alongside `doc.registered`.
const fs = require('node:fs');
const path = require('node:path');

const JOURNAL_VERSION = 1;

function journalFile(home) {
  return path.join(home, 'journal.jsonl');
}

function append(home, event) {
  fs.mkdirSync(home, { recursive: true, mode: 0o700 });
  const record = JSON.stringify({ v: JOURNAL_VERSION, ts: new Date().toISOString(), ...event });
  fs.appendFileSync(journalFile(home), record + '\n', { mode: 0o600 });
}

// Tolerant replay: a crash can tear the final line mid-append, so unparseable
// lines are skipped rather than losing the whole history.
function readAll(home) {
  let raw;
  try {
    raw = fs.readFileSync(journalFile(home), 'utf8');
  } catch {
    return [];
  }
  const events = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      // torn write — skipped
    }
  }
  return events;
}

module.exports = { journalFile, append, readAll, JOURNAL_VERSION };
