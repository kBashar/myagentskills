// The journal (CONTEXT.md): an append-only JSONL record and the source of
// truth. The daemon is the only process that appends to it; the doc registry
// is derived by replaying it, so crashes never lose state. Later tickets add
// annotation and status-change event types alongside `doc.registered`.
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureHome } from './paths';

export const JOURNAL_VERSION = 1;

export type JournalEvent = { type: string } & Record<string, unknown>;

export function journalFile(home: string): string {
  return join(home, 'journal.jsonl');
}

export function append(home: string, event: JournalEvent): void {
  ensureHome(home);
  const record = JSON.stringify({ v: JOURNAL_VERSION, ts: new Date().toISOString(), ...event });
  appendFileSync(journalFile(home), record + '\n', { mode: 0o600 });
}

// Tolerant replay: a crash can tear the final line mid-append, so unparseable
// lines are skipped rather than losing the whole history.
export function readAll(home: string): JournalEvent[] {
  let raw: string;
  try {
    raw = readFileSync(journalFile(home), 'utf8');
  } catch {
    return [];
  }
  const events: JournalEvent[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as JournalEvent);
    } catch {
      // torn write — skipped
    }
  }
  return events;
}
