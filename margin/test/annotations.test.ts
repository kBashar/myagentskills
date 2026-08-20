// The core loop (issue #3) at the project's one test seam: a real daemon on
// an ephemeral port, driven over HTTP exactly as the CLI and the injected
// layer drive it. Covers annotation creation, the drain, passive views,
// crash recovery, the SSE push channel, and serve-time layer injection.
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import * as assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import { get as httpGet } from 'node:http';
import { join } from 'node:path';
import { testDaemon } from './helpers';
import type { HttpResponse } from '../src/http-client';
import { get, post } from '../src/http-client';
import * as journal from '../src/journal';
import { LAYER_JS } from '../src/layer';

const DOC = '<!doctype html><html><body><h1>Report</h1><p>Some passage worth noting.</p></body></html>\n';

function writeDoc(home: string, name = 'report.html'): string {
  const file = join(home, name);
  writeFileSync(file, DOC);
  return file;
}

async function registerDoc(d: { port: number; token: string }, file: string): Promise<{ id: string }> {
  const res = await post(d.port, d.token, '/api/docs', {
    path: file,
    project: 'demo',
    agent: 'pi',
    session: 'sess-1',
  });
  assert.equal(res.status, 200, res.body.toString('utf8'));
  return JSON.parse(res.body.toString('utf8')).doc;
}

function annotate(
  d: { port: number; token: string },
  docId: string,
  extra: Record<string, unknown> = {}
): Promise<HttpResponse> {
  return post(d.port, d.token, '/api/annotations', {
    docId,
    quote: 'passage worth noting',
    prefix: 'p>Some ',
    suffix: '.</p>',
    trail: 'Report',
    comment: 'tighten this wording',
    ...extra,
  });
}

test('the drain returns every unread annotation and marks it read; a second drain returns empty', async (t) => {
  const d = await testDaemon(t);
  const doc = await registerDoc(d, writeDoc(d.home));
  await annotate(d, doc.id, { comment: 'first note' });
  await annotate(d, doc.id, { comment: 'second note' });

  // The drain (what `margin list --unread` calls) returns both, marked read.
  const first = await post(d.port, d.token, '/api/annotations/drain', {});
  assert.equal(first.status, 200, first.body.toString('utf8'));
  const drained = JSON.parse(first.body.toString('utf8')).annotations;
  assert.equal(drained.length, 2);
  assert.deepStrictEqual(
    drained.map((a: { comment: string }) => a.comment),
    ['first note', 'second note']
  );

  // Each drained annotation was journaled read — the status change survives crashes.
  const reads = journal.readAll(d.home).filter((e) => e.type === 'annotation.read');
  assert.equal(reads.length, 2);

  // The immediate second call an agent makes after acting returns empty.
  const second = await post(d.port, d.token, '/api/annotations/drain', {});
  assert.equal(second.status, 200);
  assert.deepStrictEqual(JSON.parse(second.body.toString('utf8')).annotations, []);

  // Drained-but-not-acted-on annotations remain visible through the read view.
  const read = await get(d.port, d.token, '/api/annotations?status=read');
  assert.equal(JSON.parse(read.body.toString('utf8')).annotations.length, 2);
  const unread = await get(d.port, d.token, '/api/annotations?status=unread');
  assert.equal(JSON.parse(unread.body.toString('utf8')).annotations.length, 0);
});

// A browser's EventSource, minimally: collects `event:`/`data:` frames and
// lets the test await a specific one.
interface SseFrame {
  event: string;
  data: string;
}
interface SseClient {
  frames: SseFrame[];
  waitFor(event: string, timeoutMs?: number): Promise<SseFrame>;
}

function connectSse(t: TestContext, port: number, path: string): Promise<SseClient> {
  return new Promise((resolvePromise, reject) => {
    const frames: SseFrame[] = [];
    const req = httpGet({ host: '127.0.0.1', port, path }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`SSE connect failed: HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      assert.match(String(res.headers['content-type']), /text\/event-stream/);
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        buf += chunk;
        let idx: number;
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          let event = 'message';
          let data = '';
          for (const line of frame.split('\n')) {
            if (line.startsWith('event: ')) event = line.slice(7);
            else if (line.startsWith('data: ')) data += line.slice(6);
          }
          if (data) frames.push({ event, data });
        }
      });
      resolvePromise({
        frames,
        waitFor(event: string, timeoutMs = 5000): Promise<SseFrame> {
          const deadline = Date.now() + timeoutMs;
          return new Promise((res2, rej2) => {
            const poll = (): void => {
              const hit = frames.find((f) => f.event === event);
              if (hit) return res2(hit);
              if (Date.now() > deadline) return rej2(new Error(`timed out waiting for SSE event ${event}`));
              setTimeout(poll, 20);
            };
            poll();
          });
        },
      });
    });
    req.on('error', reject);
    t.after(() => req.destroy());
  });
}

test('status changes push to the doc channel over SSE, no refresh', async (t) => {
  const d = await testDaemon(t);
  const doc = await registerDoc(d, writeDoc(d.home));

  const sse = await connectSse(t, d.port, `/d/${doc.id}/events?t=${d.token}`);

  // A new annotation reaches open pages immediately.
  await annotate(d, doc.id, { comment: 'live note' });
  const created = await sse.waitFor('annotation.created');
  const createdBody = JSON.parse(created.data);
  assert.equal(createdBody.comment, 'live note');
  assert.equal(createdBody.status, 'unread');

  // The drain flips the chip unread → read the moment the agent drains.
  await post(d.port, d.token, '/api/annotations/drain', {});
  const read = await sse.waitFor('annotation.read');
  assert.equal(JSON.parse(read.data).id, createdBody.id);
  assert.equal(JSON.parse(read.data).status, 'read');

  // Events for OTHER docs never reach this channel.
  const other = await registerDoc(d, writeDoc(d.home, 'other.html'));
  await annotate(d, other.id, { comment: 'not for this page' });
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(sse.frames.filter((f) => f.event === 'annotation.created').length, 1);
});

test('the SSE channel requires a valid token and a known doc', async (t) => {
  const d = await testDaemon(t);
  const doc = await registerDoc(d, writeDoc(d.home));

  let res = await get(d.port, null, `/d/${doc.id}/events`);
  assert.equal(res.status, 401);

  res = await get(d.port, 'forged', `/d/${doc.id}/events`);
  assert.equal(res.status, 401);

  res = await get(d.port, d.token, '/d/nope/events');
  assert.equal(res.status, 404);
});

test('served docs include the injected annotation layer; the file on disk stays pristine', async (t) => {
  const d = await testDaemon(t);
  const file = writeDoc(d.home);
  const doc = await registerDoc(d, file);

  const res = await get(d.port, d.token, `/d/${doc.id}`);
  assert.equal(res.status, 200);
  const served = res.body.toString('utf8');

  // The doc's own content is served intact…
  assert.ok(served.includes('<h1>Report</h1><p>Some passage worth noting.</p>'), 'doc content preserved');
  assert.ok(served.trimEnd().endsWith('</html>'), 'document structure preserved');
  // …with the annotation layer injected at serve time (ADR-0002): config,
  // styles, and the layer script, inside the body.
  assert.ok(served.includes('window.__margin'), 'layer config injected');
  assert.ok(served.includes(JSON.stringify(doc.id)), 'doc id handed to the layer');
  assert.ok(served.includes('margin-drawer'), 'drawer markup/styles injected');
  assert.ok(served.indexOf('window.__margin') > served.indexOf('</body>') === false, 'layer injected before </body>');

  // ADR-0002: the source file is never modified.
  assert.equal(readFileSync(file, 'utf8'), DOC);
});

test('docs without a </body> still get the layer appended', async (t) => {
  const d = await testDaemon(t);
  const file = join(d.home, 'fragment.html');
  writeFileSync(file, '<h1>Fragment</h1><p>no body tag here</p>\n');
  const doc = await registerDoc(d, file);

  const res = await get(d.port, d.token, `/d/${doc.id}`);
  assert.equal(res.status, 200);
  const served = res.body.toString('utf8');
  assert.ok(served.startsWith('<h1>Fragment</h1>'), 'doc content preserved');
  assert.ok(served.includes('window.__margin'), 'layer appended');
});

test('the injected layer script parses as JavaScript', () => {
  // No browser automation in v1 (issue #1 testing decisions) — but the
  // served script must at least compile. `new Function` parses without
  // executing.
  assert.doesNotThrow(() => new Function(LAYER_JS));
});

test('annotations survive a daemon restart — the journal is the source of truth', async (t) => {
  const d = await testDaemon(t);
  const doc = await registerDoc(d, writeDoc(d.home));
  await annotate(d, doc.id, { comment: 'drained before the crash' });
  await annotate(d, doc.id, { comment: 'also drained' });
  await post(d.port, d.token, '/api/annotations/drain', {});
  await annotate(d, doc.id, { comment: 'never drained' });

  // Simulate the crash: the daemon goes away and comes back with the same home.
  await new Promise<void>((resolvePromise) => d.server.close(() => resolvePromise()));
  const d2 = await testDaemon(t, { token: d.token, home: d.home });

  // Drained-but-not-acted-on annotations remain visible via the read view.
  const read = await get(d2.port, d2.token, '/api/annotations?status=read');
  const readComments = JSON.parse(read.body.toString('utf8')).annotations.map((a: { comment: string }) => a.comment);
  assert.deepStrictEqual(readComments, ['drained before the crash', 'also drained']);

  // The un-drained one is still pending — and a post-restart drain returns
  // exactly it, nothing more (the earlier drain was not replayed as unread).
  const drain = await post(d2.port, d2.token, '/api/annotations/drain', {});
  const drained = JSON.parse(drain.body.toString('utf8')).annotations;
  assert.equal(drained.length, 1);
  assert.equal(drained[0].comment, 'never drained');
});

test('list views are passive — they never mutate state', async (t) => {
  const d = await testDaemon(t);
  const doc = await registerDoc(d, writeDoc(d.home));
  await annotate(d, doc.id, { comment: 'still pending' });

  for (let i = 0; i < 2; i++) {
    const all = await get(d.port, d.token, '/api/annotations');
    assert.equal(all.status, 200);
    const [a] = JSON.parse(all.body.toString('utf8')).annotations;
    assert.equal(a.status, 'unread');

    const unread = await get(d.port, d.token, '/api/annotations?status=unread');
    assert.equal(JSON.parse(unread.body.toString('utf8')).annotations.length, 1);
  }

  // Nothing was journaled by the passive reads.
  assert.equal(journal.readAll(d.home).filter((e) => e.type === 'annotation.read').length, 0);
});

test('annotation creation validates input and requires a known doc and a valid token', async (t) => {
  const d = await testDaemon(t);
  const doc = await registerDoc(d, writeDoc(d.home));

  let res = await post(d.port, d.token, '/api/annotations', { docId: doc.id, comment: 'no quote' });
  assert.equal(res.status, 400);

  res = await post(d.port, d.token, '/api/annotations', { docId: doc.id, quote: '  ', comment: 'blank quote' });
  assert.equal(res.status, 400);

  res = await post(d.port, d.token, '/api/annotations', { docId: doc.id, quote: 'q' });
  assert.equal(res.status, 400);
  assert.match(JSON.parse(res.body.toString('utf8')).error, /comment/);

  res = await post(d.port, d.token, '/api/annotations', { quote: 'q', comment: 'c' });
  assert.equal(res.status, 400);
  assert.match(JSON.parse(res.body.toString('utf8')).error, /docId/);

  res = await post(d.port, d.token, '/api/annotations', { docId: 'nope', quote: 'q', comment: 'c' });
  assert.equal(res.status, 404);

  res = await post(d.port, null, '/api/annotations', { docId: doc.id, quote: 'q', comment: 'c' });
  assert.equal(res.status, 401);

  res = await post(d.port, 'forged', '/api/annotations', { docId: doc.id, quote: 'q', comment: 'c' });
  assert.equal(res.status, 401);

  res = await post(d.port, d.token, '/api/annotations', 'not json' as unknown as Record<string, unknown>);
  assert.equal(res.status, 400);

  res = await get(d.port, d.token, '/api/annotations?status=sideways');
  assert.equal(res.status, 400);

  // None of the rejected attempts produced journal events.
  assert.equal(journal.readAll(d.home).filter((e) => e.type.startsWith('annotation.')).length, 0);
});

test('posting an annotation stores quote, context, trail, comment, and the doc agent identity', async (t) => {
  const d = await testDaemon(t);
  const doc = await registerDoc(d, writeDoc(d.home));

  // A forged identity in the body is ignored: the daemon stamps the doc's.
  const res = await annotate(d, doc.id, { agent: 'forged', session: 'forged' });
  assert.equal(res.status, 200, res.body.toString('utf8'));
  const { annotation } = JSON.parse(res.body.toString('utf8'));

  assert.match(annotation.id, /^a-[0-9a-f]{6}$/);
  assert.equal(annotation.docId, doc.id);
  assert.equal(annotation.project, 'demo');
  assert.equal(annotation.agent, 'pi');
  assert.equal(annotation.session, 'sess-1');
  assert.equal(annotation.quote, 'passage worth noting');
  assert.equal(annotation.prefix, 'p>Some ');
  assert.equal(annotation.suffix, '.</p>');
  assert.equal(annotation.trail, 'Report');
  assert.equal(annotation.comment, 'tighten this wording');
  assert.equal(annotation.status, 'unread');
  assert.equal(typeof annotation.ts, 'string');

  // Journaled — the source of truth.
  const created = journal.readAll(d.home).filter((e) => e.type === 'annotation.created');
  assert.equal(created.length, 1);
  assert.equal((created[0] as any).annotation.id, annotation.id);

  // Visible through the passive list.
  const list = await get(d.port, d.token, '/api/annotations');
  assert.equal(list.status, 200);
  const all = JSON.parse(list.body.toString('utf8')).annotations;
  assert.equal(all.length, 1);
  assert.equal(all[0].id, annotation.id);
  assert.equal(all[0].status, 'unread');
});
