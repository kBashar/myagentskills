// Annotations (CONTEXT.md): the reader's notes, traveling one way from
// reader to agent (ADR-0005). The store is DERIVED state, rebuilt from the
// journal at daemon startup exactly like the doc registry — the journal is
// the source of truth, so crashes and restarts never lose feedback.
// Statuses are mechanical: `unread` until an agent drains the queue, then
// `read`. Margin never infers resolution.
import { randomBytes } from 'node:crypto';
import * as journal from './journal';

export type AnnotationStatus = 'unread' | 'read';

export interface Annotation {
  id: string;
  docId: string;
  project: string;
  // The DOC's agent identity, stamped by the daemon at creation — never
  // taken from the request body (the doc is the identity's source of truth).
  agent: string | null;
  session: string | null;
  quote: string;
  prefix: string; // ~40 chars of context before the quote
  suffix: string; // ~40 chars after
  trail: string; // heading trail above the passage ("Transport → Daemon & queue")
  comment: string;
  status: AnnotationStatus;
  ts: string; // ISO creation time
}

export interface AnnotationStore {
  byId: Record<string, Annotation>;
  order: string[]; // creation order — list output is chronological
}

export function createStore(): AnnotationStore {
  return { byId: Object.create(null), order: [] };
}

export function add(store: AnnotationStore, a: Annotation): void {
  if (store.byId[a.id]) return; // replay idempotence: a journaled create applies once
  store.byId[a.id] = a;
  store.order.push(a.id);
}

export function markRead(store: AnnotationStore, id: string): void {
  const a = store.byId[id];
  if (a) a.status = 'read';
}

export function list(
  store: AnnotationStore,
  filter: { status?: AnnotationStatus; docId?: string } = {}
): Annotation[] {
  const out: Annotation[] = [];
  for (const id of store.order) {
    const a = store.byId[id];
    if (filter.status && a.status !== filter.status) continue;
    if (filter.docId && a.docId !== filter.docId) continue;
    out.push(a);
  }
  return out;
}

// Annotation ids are globally unique (locate/dismiss address them without a
// doc qualifier) and URL-safe by construction.
export function mintId(store: AnnotationStore): string {
  for (;;) {
    const id = `a-${randomBytes(3).toString('hex')}`;
    if (!store.byId[id]) return id;
  }
}

// Tolerant replay (mirrors the registry): malformed events are skipped, a
// duplicated create applies once, a read for an unknown id is a no-op.
export function applyEvent(store: AnnotationStore, event: journal.JournalEvent): void {
  if (!event || typeof event !== 'object') return;
  if (event.type === 'annotation.created') {
    const a = event.annotation as Partial<Annotation> | null;
    if (!a || typeof a !== 'object') return;
    if (typeof a.id !== 'string' || typeof a.docId !== 'string' || typeof a.quote !== 'string') return;
    add(store, {
      id: a.id,
      docId: a.docId,
      project: typeof a.project === 'string' ? a.project : '',
      agent: typeof a.agent === 'string' ? a.agent : null,
      session: typeof a.session === 'string' ? a.session : null,
      quote: a.quote,
      prefix: typeof a.prefix === 'string' ? a.prefix : '',
      suffix: typeof a.suffix === 'string' ? a.suffix : '',
      trail: typeof a.trail === 'string' ? a.trail : '',
      comment: typeof a.comment === 'string' ? a.comment : '',
      status: a.status === 'read' ? 'read' : 'unread',
      ts: typeof a.ts === 'string' ? a.ts : '',
    });
    return;
  }
  if (event.type === 'annotation.read') {
    if (typeof event.id === 'string') markRead(store, event.id);
  }
}

export function load(home: string): AnnotationStore {
  const store = createStore();
  for (const event of journal.readAll(home)) applyEvent(store, event);
  return store;
}
