// `margin open <file>` — Registration (CONTEXT.md): stamp an HTML doc with a
// doc id, the project namespace (from the cwd's repo), and the calling
// agent's identity, then print the doc's token-scoped URL. Registration goes
// through the daemon over HTTP (the daemon is the sole journal writer), so
// `open` first ensures the daemon is running — agents never manage the
// process themselves.
import { ensureDaemon } from '../ensure';
import { post } from '../http-client';
import { detectProject } from '../project';
import { validateDocFile } from '../docfile';

export interface OpenOptions {
  file: string;
  docId: string | null;
  agent: string | null;
  session: string | null;
}

export async function cmdOpen(home: string, { file, docId, agent, session }: OpenOptions): Promise<void> {
  // Fail fast with the same validator the daemon applies authoritatively.
  const check = validateDocFile(file);
  if (!check.ok) throw new Error(check.reason);

  const project = detectProject(process.cwd());
  const daemon = await ensureDaemon(home);
  const res = await post(daemon.port, daemon.token, '/api/docs', {
    path: check.path,
    project,
    docId: docId ?? null,
    agent: agent ?? null,
    session: session ?? null,
  });
  if (res.status !== 200) {
    let detail = `HTTP ${res.status}`;
    try {
      const b = JSON.parse(res.body.toString('utf8')) as { error?: string };
      if (b && b.error) detail = b.error;
    } catch {
      // keep the HTTP status as the detail
    }
    throw new Error(`registration failed: ${detail}`);
  }
  const body = JSON.parse(res.body.toString('utf8')) as { url: string };
  console.log(body.url);
}
