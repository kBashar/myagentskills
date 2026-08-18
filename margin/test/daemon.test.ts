import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { testDaemon, tmpdir } from './helpers';
import type { HttpResponse } from '../src/http-client';
import { request, get, post } from '../src/http-client';
import * as journal from '../src/journal';

const DOC_BYTES = Buffer.from(
  '<!doctype html><html><body><h1>Héllo, margin ✓</h1><p>exact bytes, please</p></body></html>\n'
);

function writeDoc(home: string, bytes: Buffer = DOC_BYTES, name = 'report.html'): string {
  const file = join(home, name);
  writeFileSync(file, bytes);
  return file;
}

async function registerDoc(d: { port: number; token: string }, file: string, extra: Record<string, unknown> = {}): Promise<HttpResponse> {
  return post(d.port, d.token, '/api/docs', { path: file, project: 'demo', agent: 'pi', session: 'sess-1', ...extra });
}

test('healthz requires a valid token', async (t) => {
  const d = await testDaemon(t);

  let res = await get(d.port, null, '/healthz');
  assert.equal(res.status, 401);

  res = await get(d.port, 'wrong-token', '/healthz');
  assert.equal(res.status, 401);

  res = await get(d.port, d.token, '/healthz');
  assert.equal(res.status, 200);
  const body = JSON.parse(res.body.toString('utf8'));
  assert.equal(body.ok, true);
  assert.equal(body.service, 'margin');
  assert.equal(typeof body.pid, 'number');
});

test('registering a doc serves its exact file bytes', async (t) => {
  const d = await testDaemon(t);
  const file = writeDoc(d.home);

  const res = await registerDoc(d, file);
  assert.equal(res.status, 200, res.body.toString('utf8'));
  const body = JSON.parse(res.body.toString('utf8'));
  assert.equal(body.ok, true);
  assert.match(body.doc.id, /^report-[0-9a-f]{6}$/);
  assert.equal(body.doc.project, 'demo');
  assert.equal(body.doc.agent, 'pi');
  assert.equal(body.doc.session, 'sess-1');
  assert.equal(body.doc.path, file);

  const doc = await request({ port: d.port, path: `/d/${body.doc.id}?t=${d.token}` });
  assert.equal(doc.status, 200);
  assert.match(doc.headers['content-type'], /^text\/html/);
  assert.deepStrictEqual(doc.body, DOC_BYTES);

  // The URL as printed by `margin open` works as-is.
  const u = new URL(body.url);
  const viaUrl = await request({ port: Number(u.port), path: u.pathname + u.search });
  assert.equal(viaUrl.status, 200);
  assert.deepStrictEqual(viaUrl.body, DOC_BYTES);
});

test('doc routes reject missing/invalid tokens; unknown docs 404', async (t) => {
  const d = await testDaemon(t);
  const file = writeDoc(d.home);
  const reg = JSON.parse((await registerDoc(d, file)).body.toString('utf8'));
  const id = reg.doc.id;

  let res = await request({ port: d.port, path: `/d/${id}` });
  assert.equal(res.status, 401);

  res = await request({ port: d.port, path: `/d/${id}?t=nope` });
  assert.equal(res.status, 401);

  // The Authorization header is accepted alongside ?t=.
  res = await get(d.port, d.token, `/d/${id}`);
  assert.equal(res.status, 200);

  res = await request({ port: d.port, path: `/d/unknown-doc?t=${d.token}` });
  assert.equal(res.status, 404);

  // Even unknown routes require the token first.
  res = await request({ port: d.port, path: '/nope' });
  assert.equal(res.status, 401);
  res = await get(d.port, d.token, '/nope');
  assert.equal(res.status, 404);
});

test('every registration is journaled with doc id, project, agent, and session', async (t) => {
  const d = await testDaemon(t);
  const file = writeDoc(d.home);
  await registerDoc(d, file);
  const file2 = writeDoc(d.home, DOC_BYTES, 'notes.html');
  await registerDoc(d, file2, { agent: 'claude-code', session: null });

  const events = journal.readAll(d.home);
  const registrations = events.filter((e) => e.type === 'doc.registered');
  assert.equal(registrations.length, 2);

  const first = registrations[0] as any;
  const second = registrations[1] as any;
  assert.equal(first.v, 1);
  assert.equal(typeof first.ts, 'string');
  assert.match(first.doc.id, /^report-[0-9a-f]{6}$/);
  assert.equal(first.doc.project, 'demo');
  assert.equal(first.doc.agent, 'pi');
  assert.equal(first.doc.session, 'sess-1');
  assert.equal(first.doc.path, file);

  assert.match(second.doc.id, /^notes-[0-9a-f]{6}$/);
  assert.equal(second.doc.agent, 'claude-code');
  assert.equal(second.doc.session, null);
});

test('the registry is rebuilt from the journal across restarts', async (t) => {
  const d = await testDaemon(t);
  const file = writeDoc(d.home);
  const reg = JSON.parse((await registerDoc(d, file)).body.toString('utf8'));
  const id = reg.doc.id;

  await new Promise<void>((resolvePromise) => d.server.close(() => resolvePromise()));

  // Same home, fresh daemon: the journal is the source of truth.
  const d2 = await testDaemon(t, { token: d.token, home: d.home });
  const res = await request({ port: d2.port, path: `/d/${id}?t=${d.token}` });
  assert.equal(res.status, 200);
  assert.deepStrictEqual(res.body, DOC_BYTES);
});

test('explicit doc ids are honored, validated, and unique across projects', async (t) => {
  const d = await testDaemon(t);
  const file = writeDoc(d.home);

  let res = await registerDoc(d, file, { docId: 'my-doc' });
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(res.body.toString('utf8')).doc.id, 'my-doc');

  // Re-registration in the same project is an idempotent upsert.
  res = await registerDoc(d, file, { docId: 'my-doc' });
  assert.equal(res.status, 200);

  res = await registerDoc(d, file, { docId: 'Bad ID!' });
  assert.equal(res.status, 400);

  // The same id under a different project is a conflict, not a second doc.
  res = await post(d.port, d.token, '/api/docs', { path: file, project: 'other', docId: 'my-doc' });
  assert.equal(res.status, 409);
});

test('a doc id journaled under two projects is surfaced as a conflict, never silently served', async (t) => {
  const home = tmpdir(t);
  const file = writeDoc(home);
  // Forge a corrupt journal: the same doc id registered under two projects.
  journal.append(home, { type: 'doc.registered', doc: { id: 'clash', project: 'alpha', path: file, agent: null, session: null } });
  journal.append(home, { type: 'doc.registered', doc: { id: 'clash', project: 'beta', path: file, agent: null, session: null } });

  const d = await testDaemon(t, { home });

  // Serving the conflicted id is refused loudly — no arbitrary entry wins.
  const res = await request({ port: d.port, path: `/d/clash?t=${d.token}` });
  assert.equal(res.status, 409);
  assert.match(JSON.parse(res.body.toString('utf8')).error, /multiple projects/);

  // Registering over a conflicted id is refused too.
  const reg = await post(d.port, d.token, '/api/docs', { path: file, project: 'gamma', docId: 'clash' });
  assert.equal(reg.status, 409);

  // Every other doc is unaffected.
  const ok = await post(d.port, d.token, '/api/docs', { path: file, project: 'gamma' });
  assert.equal(ok.status, 200);
  const id = JSON.parse(ok.body.toString('utf8')).doc.id;
  const served = await request({ port: d.port, path: `/d/${id}?t=${d.token}` });
  assert.equal(served.status, 200);
  assert.deepStrictEqual(served.body, DOC_BYTES);
});

test('registration validates its input', async (t) => {
  const d = await testDaemon(t);
  const file = writeDoc(d.home);

  let res = await post(d.port, d.token, '/api/docs', { project: 'demo' });
  assert.equal(res.status, 400);

  res = await post(d.port, d.token, '/api/docs', { path: 'relative/report.html', project: 'demo' });
  assert.equal(res.status, 400);

  res = await post(d.port, d.token, '/api/docs', { path: join(d.home, 'missing.html'), project: 'demo' });
  assert.equal(res.status, 400);
  assert.match(JSON.parse(res.body.toString('utf8')).error, /no such file/);

  const txt = join(d.home, 'notes.txt');
  writeFileSync(txt, 'plain text');
  res = await post(d.port, d.token, '/api/docs', { path: txt, project: 'demo' });
  assert.equal(res.status, 400);
  assert.match(JSON.parse(res.body.toString('utf8')).error, /not an HTML file/);

  res = await post(d.port, d.token, '/api/docs', { path: file });
  assert.equal(res.status, 400);
  assert.match(JSON.parse(res.body.toString('utf8')).error, /project/);
});

test('registration rejects a missing or invalid token', async (t) => {
  const d = await testDaemon(t);
  const file = writeDoc(d.home);

  let res = await post(d.port, null, '/api/docs', { path: file, project: 'demo' });
  assert.equal(res.status, 401);

  res = await post(d.port, 'forged', '/api/docs', { path: file, project: 'demo' });
  assert.equal(res.status, 401);

  // And nothing was journaled by the rejected attempts.
  assert.equal(journal.readAll(d.home).length, 0);
});

test('a deleted doc file 404s at serve time but stays registered', async (t) => {
  const d = await testDaemon(t);
  const file = writeDoc(d.home);
  const reg = JSON.parse((await registerDoc(d, file)).body.toString('utf8'));
  rmSync(file);

  const res = await request({ port: d.port, path: `/d/${reg.doc.id}?t=${d.token}` });
  assert.equal(res.status, 404);
  assert.match(JSON.parse(res.body.toString('utf8')).error, /no longer exists/);
});

test('unknown methods on known paths 404', async (t) => {
  const d = await testDaemon(t);
  const res = await post(d.port, d.token, '/d/whatever', {});
  assert.equal(res.status, 404);
});
