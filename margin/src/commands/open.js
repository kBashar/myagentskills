'use strict';

// `margin open <file>` — Registration (CONTEXT.md): stamp an HTML doc with a
// doc id, the project namespace (from the cwd's repo), and the calling
// agent's identity, then print the doc's token-scoped URL. Registration goes
// through the daemon over HTTP (the daemon is the sole journal writer), so
// `open` first ensures the daemon is running — agents never manage the
// process themselves.
const fs = require('node:fs');
const path = require('node:path');
const { ensureDaemon } = require('../ensure');
const { post } = require('../http-client');
const { detectProject } = require('../project');

async function cmdOpen(home, { file, docId, agent, session }) {
  const abs = path.resolve(file);
  let st;
  try {
    st = fs.statSync(abs);
  } catch {
    throw new Error(`no such file: ${abs}`);
  }
  if (!st.isFile()) throw new Error(`not a file: ${abs}`);
  if (!/\.html?$/i.test(abs)) throw new Error(`not an HTML file (expected .html or .htm): ${abs}`);

  const project = detectProject(process.cwd());
  const daemon = await ensureDaemon(home);
  const res = await post(daemon.port, daemon.token, '/api/docs', {
    path: abs,
    project,
    docId: docId ?? null,
    agent: agent ?? null,
    session: session ?? null,
  });
  if (res.status !== 200) {
    let detail = `HTTP ${res.status}`;
    try {
      const b = JSON.parse(res.body.toString('utf8'));
      if (b && b.error) detail = b.error;
    } catch {
      // keep the HTTP status as the detail
    }
    throw new Error(`registration failed: ${detail}`);
  }
  const body = JSON.parse(res.body.toString('utf8'));
  console.log(body.url);
}

module.exports = { cmdOpen };
