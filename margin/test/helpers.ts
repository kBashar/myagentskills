import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { startDaemon } from '../src/daemon';
import type { RunningDaemon } from '../src/daemon';

export const TEST_TOKEN = 'test-token';

export function tmpdir(t: TestContext, prefix = 'margin-test-'): string {
  const dir = mkdtempSync(join(process.env.TMPDIR || '/tmp', prefix));
  t.after(() => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best effort
    }
  });
  return dir;
}

// A throwaway margin home for tests that spawn real daemons via the CLI.
// One t.after hook kills the daemon first and removes the directory second —
// separate hooks would run in registration order and could delete the state
// file before the pid is read.
export function daemonHome(t: TestContext): string {
  const dir = mkdtempSync(join(process.env.TMPDIR || '/tmp', 'margin-home-'));
  t.after(() => {
    try {
      const s = JSON.parse(readFileSync(join(dir, 'daemon.json'), 'utf8')) as { pid?: number };
      if (s && s.pid) process.kill(s.pid);
    } catch {
      // no daemon recorded — nothing to kill
    }
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best effort
    }
  });
  return dir;
}

export interface TestDaemon extends RunningDaemon {
  home: string;
  token: string;
}

// The project's one test seam: a real daemon on an ephemeral port, driven
// over HTTP. `home` is a throwaway margin home (journal included).
export async function testDaemon(
  t: TestContext,
  { token = TEST_TOKEN, home = null }: { token?: string; home?: string | null } = {}
): Promise<TestDaemon> {
  const h = home || tmpdir(t);
  const d = await startDaemon({ home: h, port: 0, token });
  t.after(
    () =>
      new Promise<void>((resolvePromise) => {
        d.server.close(() => resolvePromise());
        if (typeof d.server.closeIdleConnections === 'function') d.server.closeIdleConnections();
      })
  );
  return { home: h, port: d.port, token, server: d.server, ctx: d.ctx };
}
