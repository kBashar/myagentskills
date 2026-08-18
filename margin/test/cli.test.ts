// End-to-end at the real CLI surface: spawns `bin/margin.js` with a
// throwaway MARGIN_HOME, exactly as an agent's bash tool would. The bin runs
// the compiled output (ADR-0006) — `npm test` builds before running.
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import * as assert from 'node:assert/strict';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { tmpdir, daemonHome } from './helpers';
import { request } from '../src/http-client';
import * as journal from '../src/journal';

// Compiled tests live in dist/test/, so the package root is two levels up.
const BIN = join(__dirname, '..', '..', 'bin', 'margin.js');

function run(args: string[], { home, cwd }: { home: string; cwd?: string }): { status: number | null; stdout: string; stderr: string } {
  return spawnSync(process.execPath, [BIN, ...args], {
    env: { ...process.env, MARGIN_HOME: home },
    cwd,
    encoding: 'utf8',
    timeout: 30_000,
  });
}

function readStateFile(home: string): { v: number; port: number; token: string; pid: number; startedAt: string } {
  return JSON.parse(readFileSync(join(home, 'daemon.json'), 'utf8'));
}

test('serve --ensure twice results in exactly one daemon; the second reports it', async (t) => {
  const home = daemonHome(t);

  let r = run(['serve', '--ensure'], { home });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /started/);

  const s1 = readStateFile(home);
  assert.ok(s1.port > 0, 'port recorded in the state file');
  assert.ok(typeof s1.token === 'string' && s1.token.length >= 32, 'token recorded in the state file');
  // The state file holds the bearer token: it must not be world-readable.
  assert.equal(statSync(join(home, 'daemon.json')).mode & 0o777, 0o600);

  const health = await request({ port: s1.port, path: `/healthz?t=${s1.token}` });
  assert.equal(health.status, 200);
  const pid1 = JSON.parse(health.body.toString('utf8')).pid;

  r = run(['serve', '--ensure'], { home });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /already running/);

  // Same daemon, same state — no second process was started.
  const s2 = readStateFile(home);
  assert.equal(s2.port, s1.port);
  assert.equal(s2.token, s1.token);
  assert.equal(s2.pid, pid1);

  // Plain foreground `serve` is idempotent too: it reports and exits 0.
  r = run(['serve'], { home });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /already running/);
});

test('open prints a token-scoped URL that serves the exact bytes', async (t) => {
  const home = daemonHome(t);

  // A fake git project so project namespacing is exercised.
  const proj = tmpdir(t, 'margin-proj-');
  mkdirSync(join(proj, '.git'));
  const fileBytes = Buffer.from('<!doctype html><html><body><h1>Status ✓</h1></body></html>\n');
  writeFileSync(join(proj, 'status report.html'), fileBytes);

  // No daemon is running: open must ensure it on its own.
  const r = run(['open', 'status report.html', '--agent', 'pi', '--session', 's-42'], { home, cwd: proj });
  assert.equal(r.status, 0, r.stderr);
  const url = r.stdout.trim();
  assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/d\/status-report-[0-9a-f]{6}\?t=.+/);

  const u = new URL(url);
  const res = await request({ port: Number(u.port), path: u.pathname + u.search });
  assert.equal(res.status, 200);
  assert.deepStrictEqual(res.body, fileBytes);

  // The same URL without the token is rejected.
  const denied = await request({ port: Number(u.port), path: u.pathname });
  assert.equal(denied.status, 401);

  // The registration was journaled with the project namespace and agent identity.
  const events = journal.readAll(home);
  const registrations = events.filter((e) => e.type === 'doc.registered');
  assert.equal(registrations.length, 1);
  const doc = (registrations[0] as any).doc;
  assert.equal(doc.project, basename(proj));
  assert.equal(doc.agent, 'pi');
  assert.equal(doc.session, 's-42');
});

test('open --doc uses the explicit doc id in the URL', async (t) => {
  const home = daemonHome(t);
  const proj = tmpdir(t, 'margin-proj-');
  writeFileSync(join(proj, 'a.html'), '<!doctype html><html></html>\n');

  const r = run(['open', 'a.html', '--doc', 'quarterly-review'], { home, cwd: proj });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout.trim(), /\/d\/quarterly-review\?t=/);
});

test('open fails cleanly on missing files and non-HTML files', async (t) => {
  const home = tmpdir(t);
  const proj = tmpdir(t, 'margin-proj-');
  writeFileSync(join(proj, 'notes.txt'), 'plain');

  let r = run(['open', 'missing.html'], { home, cwd: proj });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no such file/);

  r = run(['open', 'notes.txt'], { home, cwd: proj });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not an HTML file/);
});

// Occupies a port with a plain (non-margin) HTTP server and points the
// state file at it, as if a foreign process had taken the recorded port.
// (pid is far above any real pid_max, so the cleanup hook's kill is a safe
// no-op.)
async function squatRecordedPort(t: TestContext, home: string): Promise<number> {
  const squat: Server = createServer((req, res) => {
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolvePromise) => squat.listen(0, '127.0.0.1', () => resolvePromise()));
  t.after(
    () =>
      new Promise<void>((resolvePromise) => {
        squat.close(() => resolvePromise());
      })
  );
  const port = squat.address().port;
  writeFileSync(
    join(home, 'daemon.json'),
    JSON.stringify({ v: 1, port, token: 'sq'.repeat(24), pid: 2 ** 30, startedAt: new Date().toISOString() }),
    { mode: 0o600 }
  );
  return port;
}

test('serve fails loudly when the recorded port is held by a foreign process', async (t) => {
  const home = daemonHome(t);
  const port = await squatRecordedPort(t, home);

  // The daemon refuses to silently move ports: previously printed URLs point
  // at the recorded one.
  const r = run(['serve'], { home });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not a healthy margin daemon/);
  assert.match(r.stderr, /refuses to silently switch ports/);
  assert.match(r.stderr, new RegExp(String(port)));

  // The state file is untouched — no silent port switch was recorded.
  assert.equal(readStateFile(home).port, port);
  assert.equal(readStateFile(home).token, 'sq'.repeat(24));
});

test('serve --ensure surfaces the foreign-port failure instead of a bare timeout', async (t) => {
  const home = daemonHome(t);
  const port = await squatRecordedPort(t, home);

  // The spawned daemon exits at startup; ensure reports its reason from the
  // log rather than failing with the generic start timeout.
  const r = run(['serve', '--ensure'], { home });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /exited during startup/);
  assert.match(r.stderr, /not a healthy margin daemon/);
  assert.match(r.stderr, new RegExp(String(port)));

  // Still no silent port switch.
  assert.equal(readStateFile(home).port, port);
});

test('unknown commands and flags are usage errors', async (t) => {
  const home = tmpdir(t);

  let r = run(['frobnicate'], { home });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /unknown command/);

  r = run(['serve', '--bogus'], { home });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /unknown option/);

  r = run(['open'], { home });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /requires a file/);
});
