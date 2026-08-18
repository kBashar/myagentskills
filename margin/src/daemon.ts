// The margin daemon (CONTEXT.md): the single loopback-only process serving
// every registered doc for every project. A token is required on every route
// (ADR-0003); all token verification and token-scoped URL construction goes
// through the auth module — nothing here extracts, compares, or embeds
// tokens itself.
//
// Later tickets extend this server at two deliberate seams:
//   - route(): annotation POST/GET, dismiss, and the per-doc SSE channel;
//   - handleDoc(): the injected layer (ADR-0002) transforms the pristine
//     bytes at serve time. The source file on disk is never modified.
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { isAuthorized, scopedUrl } from './auth';
import * as journal from './journal';
import * as registry from './registry';
import { validateDocFile } from './docfile';
import { VERSION } from './version';

export const MAX_BODY_BYTES = 1024 * 1024;

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

// One message for every doc-id conflict the journal produced at replay —
// surfaced at serve time and at registration alike.
function conflictError(id: string, projects: string[]): HttpError {
  return new HttpError(
    409,
    `doc id ${JSON.stringify(id)} is registered under multiple projects (${projects.join(', ')}); ` +
      `the journal is corrupt and margin will not serve or accept an arbitrary entry`
  );
}

export interface DaemonContext {
  home: string;
  token: string;
  registry: registry.Registry;
  port: number | null;
}

function sendJson(res: ServerResponse, status: number, obj: unknown): void {
  const body = Buffer.from(JSON.stringify(obj) + '\n');
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': body.length });
  res.end(body);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    req.on('data', (chunk: Buffer) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        settled = true;
        req.resume(); // drain so the response can still be sent
        reject(new HttpError(413, 'request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!settled) resolvePromise(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

function docUrl(ctx: DaemonContext, id: string): string {
  // The auth module is the only place token-scoped (?t=…) URLs are built.
  return scopedUrl(`http://127.0.0.1:${ctx.port}/d/${encodeURIComponent(id)}`, ctx.token);
}

interface RegisterBody {
  path?: unknown;
  project?: unknown;
  docId?: unknown;
  agent?: unknown;
  session?: unknown;
}

// Registration (CONTEXT.md): stamp a doc with id + project + agent identity,
// journal it, and make it servable. The daemon is the sole journal writer,
// which is why registration arrives over HTTP rather than the CLI writing
// files itself.
async function handleRegister(ctx: DaemonContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const raw = await readBody(req);
  let body: RegisterBody;
  try {
    body = JSON.parse(raw) as RegisterBody;
  } catch {
    throw new HttpError(400, 'request body must be JSON');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'request body must be a JSON object');
  }
  const { docId, agent, session } = body;
  if (typeof body.path !== 'string' || !body.path) throw new HttpError(400, 'missing required field: path');
  if (!isAbsolute(body.path)) throw new HttpError(400, `path must be absolute: ${JSON.stringify(body.path)}`);
  if (typeof body.project !== 'string' || !body.project) throw new HttpError(400, 'missing required field: project');
  if (docId != null && (typeof docId !== 'string' || !registry.isValidDocId(docId))) {
    throw new HttpError(400, `invalid doc id: ${JSON.stringify(docId)} (must match ${registry.DOC_ID_RE})`);
  }
  if (agent != null && typeof agent !== 'string') throw new HttpError(400, 'agent must be a string');
  if (session != null && typeof session !== 'string') throw new HttpError(400, 'session must be a string');

  // The shared doc-file validator — the CLI ran the same check before calling.
  const check = validateDocFile(body.path);
  if (!check.ok) throw new HttpError(400, check.reason);

  const id = (typeof docId === 'string' && docId) || registry.deriveDocId(body.project, check.path);
  const existing = registry.findDoc(ctx.registry, id);
  if (existing.kind === 'conflict') throw conflictError(id, existing.projects);
  if (existing.kind === 'found' && existing.doc.project !== body.project) {
    throw new HttpError(
      409,
      `doc id ${JSON.stringify(id)} is already registered in project ${JSON.stringify(existing.doc.project)}`
    );
  }

  const entry: registry.DocEntry = {
    id,
    project: body.project,
    path: check.path,
    agent: typeof agent === 'string' ? agent : null,
    session: typeof session === 'string' ? session : null,
  };
  journal.append(ctx.home, { type: 'doc.registered', doc: entry });
  registry.upsert(ctx.registry, entry);
  sendJson(res, 200, { ok: true, doc: entry, url: docUrl(ctx, id) });
}

// Serves the pristine file bytes (ADR-0002). This is the one place where doc
// bytes become a response — later tickets inject the annotation layer here.
function handleDoc(ctx: DaemonContext, res: ServerResponse, id: string): void {
  const found = registry.findDoc(ctx.registry, id);
  if (found.kind === 'conflict') throw conflictError(id, found.projects);
  if (found.kind === 'missing') throw new HttpError(404, `unknown doc: ${id}`);
  let bytes: Buffer;
  try {
    bytes = readFileSync(found.doc.path); // read per request: edits on disk are visible immediately
  } catch {
    throw new HttpError(404, `doc file no longer exists: ${found.doc.path}`);
  }
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'content-length': bytes.length,
    'cache-control': 'no-store',
  });
  res.end(bytes);
}

async function route(ctx: DaemonContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (!isAuthorized(req, url, ctx.token)) throw new HttpError(401, 'missing or invalid token');

  if (req.method === 'GET' && url.pathname === '/healthz') {
    sendJson(res, 200, { ok: true, service: 'margin', version: VERSION, pid: process.pid });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/docs') {
    await handleRegister(ctx, req, res);
    return;
  }
  const docMatch = /^\/d\/([^/]+)$/.exec(url.pathname);
  if (docMatch && req.method === 'GET') {
    handleDoc(ctx, res, decodeURIComponent(docMatch[1]));
    return;
  }
  throw new HttpError(404, 'not found');
}

export function createDaemon({ home, token }: { home: string; token: string }): { server: Server; ctx: DaemonContext } {
  const reg = registry.load(home);
  const conflictIds = Object.keys(reg.conflicts);
  if (conflictIds.length > 0) {
    console.error(
      `margin: journal corruption — doc id(s) registered under multiple projects: ${conflictIds.join(', ')}; ` +
        `refusing to serve them (see ${journal.journalFile(home)})`
    );
  }
  const ctx: DaemonContext = { home, token, registry: reg, port: null };
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    route(ctx, req, res).catch((err: unknown) => {
      const status = err instanceof HttpError ? err.status : 500;
      if (status >= 500) console.error(err instanceof Error && err.stack ? err.stack : err);
      if (!res.headersSent) sendJson(res, status, { error: err instanceof HttpError ? err.message : 'internal error' });
      if (!res.writableEnded) res.end();
    });
  });
  return { server, ctx };
}

export interface RunningDaemon {
  server: Server;
  port: number;
  ctx: DaemonContext;
}

// Binds 127.0.0.1 only (ADR-0003). `port: 0` asks the OS for an ephemeral
// port — the project's one test seam, and the first-run default before any
// port has been recorded.
export function startDaemon({ home, port = 0, token }: { home: string; port?: number; token: string }): Promise<RunningDaemon> {
  const { server, ctx } = createDaemon({ home, token });
  return new Promise((resolvePromise, reject) => {
    const onError = (err: Error): void => reject(err);
    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', onError);
      ctx.port = server.address().port;
      resolvePromise({ server, port: ctx.port, ctx });
    });
  });
}
