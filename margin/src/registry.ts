// The doc registry (CONTEXT.md): every registered doc, grouped under its
// project namespace (ADR-0003 — filtering is metadata, not process
// boundaries). The registry is DERIVED state: rebuilt from the journal at
// daemon startup and updated in memory on each registration; nothing
// persists it separately.
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import * as journal from './journal';

// Doc ids appear in URLs (/d/<id>), so they stay lowercase and URL-safe.
export const DOC_ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export interface DocEntry {
  id: string;
  project: string;
  path: string;
  agent: string | null;
  session: string | null;
}

export interface Registry {
  projects: Record<string, Record<string, DocEntry>>;
  // Doc ids the journal registered under MORE THAN ONE project. Doc ids are
  // globally unique; a journal that violates this is corrupt, and the id is
  // surfaced through this map — never silently served from whichever entry a
  // scan happened to hit first (review finding, issue #2).
  conflicts: Record<string, string[]>;
}

export type DocLookup =
  | { kind: 'found'; doc: DocEntry }
  | { kind: 'conflict'; id: string; projects: string[] }
  | { kind: 'missing' };

export function createRegistry(): Registry {
  return { projects: Object.create(null), conflicts: Object.create(null) };
}

// Re-registering a doc id within the same project is an upsert (agents
// regenerate docs); the journal keeps every registration event regardless.
export function upsert(reg: Registry, doc: DocEntry): void {
  let ns = reg.projects[doc.project];
  if (!ns) {
    ns = Object.create(null);
    reg.projects[doc.project] = ns;
  }
  ns[doc.id] = {
    id: doc.id,
    project: doc.project,
    path: doc.path,
    agent: doc.agent ?? null,
    session: doc.session ?? null,
  };
}

// Marks an id as conflicted: every project the journal placed it under,
// sorted. A conflicted id is never upserted again.
function poisonConflict(reg: Registry, id: string, project: string): void {
  const projects = new Set<string>(reg.conflicts[id] ?? []);
  projects.add(project);
  for (const p of Object.keys(reg.projects)) {
    if (reg.projects[p][id]) projects.add(p);
  }
  reg.conflicts[id] = [...projects].sort();
}

export function applyEvent(reg: Registry, event: journal.JournalEvent): void {
  if (!event || event.type !== 'doc.registered' || !event.doc) return;
  const d = event.doc as Partial<DocEntry>;
  if (typeof d.id !== 'string' || typeof d.project !== 'string' || typeof d.path !== 'string') return;
  const doc: DocEntry = {
    id: d.id,
    project: d.project,
    path: d.path,
    agent: d.agent ?? null,
    session: d.session ?? null,
  };
  // Replay defends global doc-id uniqueness: a cross-project collision in the
  // journal poisons the id instead of silently overwriting an entry.
  if (reg.conflicts[doc.id]) {
    poisonConflict(reg, doc.id, doc.project);
    return;
  }
  const existing = findInProjects(reg, doc.id);
  if (existing && existing.project !== doc.project) {
    poisonConflict(reg, doc.id, doc.project);
    return;
  }
  upsert(reg, doc);
}

export function load(home: string): Registry {
  const reg = createRegistry();
  for (const event of journal.readAll(home)) applyEvent(reg, event);
  return reg;
}

function findInProjects(reg: Registry, id: string): DocEntry | null {
  for (const project of Object.keys(reg.projects)) {
    const doc = reg.projects[project][id];
    if (doc) return doc;
  }
  return null;
}

// Doc ids are globally unique by construction, so lookup by id alone is
// unambiguous — unless the journal itself was corrupt, in which case the id
// is reported as a conflict rather than resolved arbitrarily.
export function findDoc(reg: Registry, id: string): DocLookup {
  const conflict = reg.conflicts[id];
  if (conflict) return { kind: 'conflict', id, projects: conflict };
  const doc = findInProjects(reg, id);
  return doc ? { kind: 'found', doc } : { kind: 'missing' };
}

function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return s || 'doc';
}

// Default doc id: filename slug + a short hash of project + absolute path.
// Re-opening the same file from the same project yields the same id
// (idempotent re-registration); files sharing a basename never collide.
export function deriveDocId(project: string, absPath: string): string {
  const base = basename(absPath).replace(/\.[^.]*$/, '');
  const hash = createHash('sha256').update(`${project}\0${absPath}`).digest('hex').slice(0, 6);
  return `${slugify(base)}-${hash}`;
}

export function isValidDocId(id: string): boolean {
  return DOC_ID_RE.test(id);
}
