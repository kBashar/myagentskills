// The one doc-file validator, shared by the CLI and the daemon (review
// finding, issue #2): `margin open` fails before ever contacting the daemon,
// and the daemon re-validates authoritatively at registration. One module,
// one set of messages — the two callers can never drift apart.
import { statSync } from 'node:fs';
import { resolve } from 'node:path';

export type DocFileCheck = { ok: true; path: string } | { ok: false; reason: string };

export function validateDocFile(file: string): DocFileCheck {
  const abs = resolve(file);
  let st: ReturnType<typeof statSync>;
  try {
    st = statSync(abs);
  } catch {
    return { ok: false, reason: `no such file: ${abs}` };
  }
  if (!st.isFile()) return { ok: false, reason: `not a file: ${abs}` };
  if (!/\.html?$/i.test(abs)) {
    return { ok: false, reason: `not an HTML file (expected .html or .htm): ${abs}` };
  }
  return { ok: true, path: abs };
}
