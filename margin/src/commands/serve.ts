// `margin serve` — runs the daemon in the foreground. Idempotent: when a
// healthy daemon already answers on the recorded port, reports it and exits
// 0. The startup lock serializes probe→bind→record across processes, so
// concurrent starters converge on exactly one daemon per margin home.
import { startDaemon } from '../daemon';
import type { RunningDaemon } from '../daemon';
import { generateToken } from '../auth';
import { readState, stateFile, writeState } from '../state';
import { acquireStartupLock } from '../lock';
import { probe } from '../ensure';

export async function cmdServe(home: string): Promise<number> {
  let daemon: RunningDaemon | null = null;
  const lock = await acquireStartupLock(home);
  try {
    const running = await probe(home);
    if (running) {
      console.log(`margin daemon already running at http://127.0.0.1:${running.port} (pid ${running.pid})`);
      return 0;
    }

    const prev = readState(home);
    // The token is minted once and reused across restarts, so doc URLs that
    // were already printed keep working (ADR-0003). The recorded port is
    // preferred for the same reason.
    const token = prev && prev.token ? prev.token : generateToken();
    if (prev) {
      // A recorded port held by a foreign process fails loudly rather than
      // silently moving to a fresh port: every doc URL already printed points
      // at the recorded port, and a quiet switch would strand them all
      // (review finding, issue #2 — documented in README).
      try {
        daemon = await startDaemon({ home, port: prev.port, token });
      } catch (err: any) {
        if (err && err.code === 'EADDRINUSE') {
          throw new Error(
            `port ${prev.port} is held by a process that is not a healthy margin daemon.\n` +
              `margin refuses to silently switch ports: doc URLs already printed point at port ${prev.port}.\n` +
              `Free the port and retry, or remove ${stateFile(home)} to mint a fresh port and token ` +
              `(this invalidates previously printed URLs).`
          );
        }
        throw err;
      }
    } else {
      // First run: no recorded port, so the OS assigns an ephemeral one.
      daemon = await startDaemon({ home, port: 0, token });
    }

    writeState(home, { v: 1, port: daemon.port, token, pid: process.pid, startedAt: new Date().toISOString() });
    console.log(`margin daemon serving at http://127.0.0.1:${daemon.port} (pid ${process.pid})`);
    console.log(`home: ${home}`);
  } finally {
    lock.release();
  }

  const started = daemon;
  if (!started) throw new Error('daemon failed to start'); // unreachable — startDaemon threw otherwise

  // Foreground: serve until signalled.
  await new Promise<void>((resolvePromise) => {
    process.once('SIGINT', () => resolvePromise());
    process.once('SIGTERM', () => resolvePromise());
  });
  await new Promise<void>((resolvePromise) => {
    started.server.close(() => resolvePromise());
    if (typeof started.server.closeIdleConnections === 'function') started.server.closeIdleConnections();
  });
  return 0;
}
