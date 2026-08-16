'use strict';

// The doc registry (CONTEXT.md): every registered doc, grouped under its
// project namespace (ADR-0003 — filtering is metadata, not process
// boundaries). The registry is DERIVED state: rebuilt from the journal at
// daemon startup and updated in memory on each registration; nothing
// persists it separately.
const crypto = require('node:crypto');
const path = require('node:path');
const journal = require('./journal');

// Doc ids appear in URLs (/d/<id>), so they stay lowercase and URL-safe.
const DOC_ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

function create() {
  return { projects: Object.create(null) };
}

// Re-registering a doc id within the same project is an upsert (agents
// regenerate docs); the journal keeps every registration event regardless.
function upsert(reg, doc) {
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

function applyEvent(reg, event) {
  if (!event || event.type !== 'doc.registered' || !event.doc) return;
  const d = event.doc;
  if (typeof d.id !== 'string' || typeof d.project !== 'string' || typeof d.path !== 'string') return;
  upsert(reg, d);
}

function load(home) {
  const reg = create();
  for (const event of journal.readAll(home)) applyEvent(reg, event);
  return reg;
}

// Doc ids are globally unique by construction, so lookup by id alone is
// unambiguous even though storage is project-namespaced.
function findDoc(reg, id) {
  for (const project of Object.keys(reg.projects)) {
    const doc = reg.projects[project][id];
    if (doc) return doc;
  }
  return null;
}

function slugify(name) {
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
function deriveDocId(project, absPath) {
  const base = path.basename(absPath).replace(/\.[^.]*$/, '');
  const hash = crypto.createHash('sha256').update(`${project}\0${absPath}`).digest('hex').slice(0, 6);
  return `${slugify(base)}-${hash}`;
}

function isValidDocId(id) {
  return DOC_ID_RE.test(id);
}

module.exports = {
  DOC_ID_RE,
  create,
  upsert,
  applyEvent,
  load,
  findDoc,
  deriveDocId,
  isValidDocId,
};
