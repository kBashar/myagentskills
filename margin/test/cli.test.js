'use strict';

// End-to-end at the real CLI surface: spawns `bin/margin.js` with a
// throwaway MARGIN_HOME, exactly as an agent's bash tool would.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { tmpdir, daemonHome } = require('./helpers');
const { request } = require('../src/http-client');
const journal = require('../src/journal');

const BIN = path.join(__dirname, '..', 'bin', 'margin.js');

function run(args, { home, cwd } = {}) {
  return spawnSync(process.execPath, [BIN, ...args], {
    env: { ...process.env, MARGIN_HOME: home },
    cwd,
    encoding: 'utf8',
    timeout: 30_000,
  });
}

function readStateFile(home) {
  return JSON.parse(fs.readFileSync(path.join(home, 'daemon.json'), 'utf8'));
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
  assert.equal(fs.statSync(path.join(home, 'daemon.json')).mode & 0o777, 0o600);

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
  fs.mkdirSync(path.join(proj, '.git'));
  const fileBytes = Buffer.from('<!doctype html><html><body><h1>Status ✓</h1></body></html>\n');
  fs.writeFileSync(path.join(proj, 'status report.html'), fileBytes);

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
  assert.equal(registrations[0].doc.project, path.basename(proj));
  assert.equal(registrations[0].doc.agent, 'pi');
  assert.equal(registrations[0].doc.session, 's-42');
});

test('open --doc uses the explicit doc id in the URL', async (t) => {
  const home = daemonHome(t);
  const proj = tmpdir(t, 'margin-proj-');
  fs.writeFileSync(path.join(proj, 'a.html'), '<!doctype html><html></html>\n');

  const r = run(['open', 'a.html', '--doc', 'quarterly-review'], { home, cwd: proj });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout.trim(), /\/d\/quarterly-review\?t=/);
});

test('open fails cleanly on missing files and non-HTML files', async (t) => {
  const home = tmpdir(t);
  const proj = tmpdir(t, 'margin-proj-');
  fs.writeFileSync(path.join(proj, 'notes.txt'), 'plain');

  let r = run(['open', 'missing.html'], { home, cwd: proj });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no such file/);

  r = run(['open', 'notes.txt'], { home, cwd: proj });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not an HTML file/);
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
