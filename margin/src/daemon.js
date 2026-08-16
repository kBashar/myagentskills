'use strict';

// The margin daemon (CONTEXT.md): the single loopback-only process serving
// every registered doc for every project. A token is required on every route
// (ADR-0003); all token verification goes through the auth module — nothing
// here extracts or compares tokens itself.
//
// Later tickets extend this server at two deliberate seams:
//   - route(): annotation POST/GET, dismiss, and the per-doc SSE channel;
//   - handleDoc(): the injected layer (ADR-0002) transforms the pristine
//     bytes at serve time. The source file on disk is never modified.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { isAuthorized } = require('./auth');
const journal = require('./journal');
const registry = require('./registry');

const VERSION = require('../package.json').version;

const MAX_BODY_BYTES = 1024 * 1024;

function httpError(status, message) {
  return Object.assign(new Error(message), { status, expose: true });
}

function sendJson(res, status, obj) {
  const body = Buffer.from(JSON.stringify(obj) + '\n');
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': body.length });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        settled = true;
        req.resume(); // drain so the response can still be sent
        reject(httpError(413, 'request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!settled) resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

function docUrl(ctx, id) {
  return `http://127.0.0.1:${ctx.port}/d/${encodeURIComponent(id)}?t=${ctx.token}`;
}

// Registration (CONTEXT.md): stamp a doc with id + project + agent identity,
// journal it, and make it servable. The daemon is the sole journal writer,
// which is why registration arrives over HTTP rather than the CLI writing
// files itself.
async function handleRegister(ctx, req, res) {
  const raw = await readBody(req);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw httpError(400, 'request body must be JSON');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(400, 'request body must be a JSON object');
  }
  const { docId, agent, session } = body;
  if (typeof body.path !== 'string' || !body.path) throw httpError(400, 'missing required field: path');
  if (!path.isAbsolute(body.path)) throw httpError(400, `path must be absolute: ${JSON.stringify(body.path)}`);
  if (typeof body.project !== 'string' || !body.project) throw httpError(400, 'missing required field: project');
  if (docId != null && (typeof docId !== 'string' || !registry.isValidDocId(docId))) {
    throw httpError(400, `invalid doc id: ${JSON.stringify(docId)} (must match ${registry.DOC_ID_RE})`);
  }
  if (agent != null && typeof agent !== 'string') throw httpError(400, 'agent must be a string');
  if (session != null && typeof session !== 'string') throw httpError(400, 'session must be a string');

  const abs = path.resolve(body.path);
  let st;
  try {
    st = fs.statSync(abs);
  } catch {
    throw httpError(400, `no such file: ${abs}`);
  }
  if (!st.isFile()) throw httpError(400, `not a file: ${abs}`);
  if (!/\.html?$/i.test(abs)) throw httpError(400, `not an HTML file (expected .html or .htm): ${abs}`);

  const id = docId || registry.deriveDocId(body.project, abs);
  const existing = registry.findDoc(ctx.registry, id);
  if (existing && existing.project !== body.project) {
    throw httpError(409, `doc id ${JSON.stringify(id)} is already registered in project ${JSON.stringify(existing.project)}`);
  }

  const entry = { id, project: body.project, path: abs, agent: agent ?? null, session: session ?? null };
  journal.append(ctx.home, { type: 'doc.registered', doc: entry });
  registry.upsert(ctx.registry, entry);
  sendJson(res, 200, { ok: true, doc: entry, url: docUrl(ctx, id) });
}

// Serves the pristine file bytes (ADR-0002). This is the one place where doc
// bytes become a response — later tickets inject the annotation layer here.
function handleDoc(ctx, req, res, id) {
  const doc = registry.findDoc(ctx.registry, id);
  if (!doc) throw httpError(404, `unknown doc: ${id}`);
  let bytes;
  try {
    bytes = fs.readFileSync(doc.path); // read per request: edits on disk are visible immediately
  } catch {
    throw httpError(404, `doc file no longer exists: ${doc.path}`);
  }
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'content-length': bytes.length,
    'cache-control': 'no-store',
  });
  res.end(bytes);
}

async function route(ctx, req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (!isAuthorized(req, url, ctx.token)) throw httpError(401, 'missing or invalid token');

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
    handleDoc(ctx, req, res, decodeURIComponent(docMatch[1]));
    return;
  }
  throw httpError(404, 'not found');
}

function createDaemon({ home, token }) {
  const ctx = { home, token, registry: registry.load(home), port: null };
  const server = http.createServer((req, res) => {
    route(ctx, req, res).catch((err) => {
      const status = typeof err.status === 'number' ? err.status : 500;
      if (status >= 500) console.error(err && err.stack ? err.stack : err);
      if (!res.headersSent) sendJson(res, status, { error: err.expose ? err.message : 'internal error' });
      if (!res.writableEnded) res.end();
    });
  });
  return { server, ctx };
}

// Binds 127.0.0.1 only (ADR-0003). `port: 0` asks the OS for an ephemeral
// port — the project's one test seam, and the fallback when the recorded
// port turns out to be taken by a foreign process.
function startDaemon({ home, port = 0, token }) {
  const { server, ctx } = createDaemon({ home, token });
  return new Promise((resolve, reject) => {
    const onError = (err) => reject(err);
    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', onError);
      ctx.port = server.address().port;
      resolve({ server, port: ctx.port, ctx });
    });
  });
}

module.exports = { createDaemon, startDaemon, MAX_BODY_BYTES };
