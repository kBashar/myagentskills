// Startup lock: serializes the probe→bind→record sequence of daemon startup
// so two concurrent `margin serve` invocations (e.g. two agents racing
// `serve --ensure`) can never bind two daemons for the same margin home.
// mkdir is atomic on POSIX; a lock abandoned mid-startup goes stale and is
// broken after STALE_MS.
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureHome } from './paths';

const STALE_MS = 30_000;

export interface StartupLock {
  release(): void;
}

export async function acquireStartupLock(
  home: string,
  { timeoutMs = 10_000 }: { timeoutMs?: number } = {}
): Promise<StartupLock> {
  ensureHome(home);
  const dir = join(home, 'daemon.lock');
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      mkdirSync(dir, 0o700);
      writeFileSync(join(dir, 'pid'), `${process.pid}\n`, { mode: 0o600 });
      return {
        release(): void {
          try {
            rmSync(dir, { recursive: true, force: true });
          } catch {
            // best effort — a leftover lock goes stale and gets broken
          }
        },
      };
    } catch (err: any) {
      if (!err || err.code !== 'EEXIST') throw err;
      try {
        const st = statSync(dir);
        if (Date.now() - st.mtimeMs > STALE_MS) {
          rmSync(dir, { recursive: true, force: true });
          continue;
        }
      } catch {
        continue; // the lock vanished between checks — retry
      }
      if (Date.now() > deadline) throw new Error('timed out waiting for the daemon startup lock');
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}
