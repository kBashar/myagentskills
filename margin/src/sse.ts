// The per-doc SSE channel (CONTEXT.md — Daemon: "pushes live updates to open
// pages"). Status changes reach an open page the moment they happen, so a
// chip flips unread → read when an agent drains the queue — no refresh.
// Channels are per doc: a page never hears about other docs' annotations.
import type { ServerResponse } from 'node:http';

export interface SseHub {
  subscribe(docId: string, res: ServerResponse): void;
  publish(docId: string, event: string, data: unknown): void;
  closeAll(): void;
}

// Keeps connections (and browser reconnect backoff) healthy without traffic.
const HEARTBEAT_MS = 25_000;

export function createHub(): SseHub {
  const clients = new Map<string, Set<ServerResponse>>();
  const heartbeat = setInterval(() => {
    for (const subs of clients.values()) {
      for (const res of subs) res.write(': hb\n\n');
    }
  }, HEARTBEAT_MS);
  // The heartbeat must never keep the process — or a test runner — alive.
  heartbeat.unref();

  function subscribe(docId: string, res: ServerResponse): void {
    let subs = clients.get(docId);
    if (!subs) {
      subs = new Set();
      clients.set(docId, subs);
    }
    subs.add(res);
    res.on('close', () => {
      subs.delete(res);
      if (subs.size === 0) clients.delete(docId);
    });
  }

  function publish(docId: string, event: string, data: unknown): void {
    const subs = clients.get(docId);
    if (!subs) return;
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of subs) res.write(frame);
  }

  // The daemon calls this on server close so open event streams never block
  // a shutdown (or a test's teardown).
  function closeAll(): void {
    clearInterval(heartbeat);
    for (const subs of clients.values()) {
      for (const res of subs) res.end();
    }
    clients.clear();
  }

  return { subscribe, publish, closeAll };
}
