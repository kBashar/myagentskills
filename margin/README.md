# margin

A local feedback loop between agent-generated HTML docs and coding agents.
One loopback-only daemon serves registered docs; a single CLI works
identically across pi, Claude Code, Codex, and OpenCode (ADR-0001).

This package currently contains the **daemon core**: `serve` and `open`.
Annotation collection, the injected browser layer, live reload, and the
`list` / `locate` / `dismiss` / `install-skill` commands land in later
tickets — see `docs/adr/` for the binding decisions. Vocabulary used
throughout the code is defined in `CONTEXT.md`.

## Requirements

Plain Node (>= 18). Zero runtime dependencies — the source is TypeScript,
compiled at build time with `typescript` as the sole devDependency
(ADR-0006); the bin runs the compiled output in `dist/`.

## Install

```sh
cd margin
npm install     # dev only: fetches typescript
npm run build   # compiles src/ + test/ to dist/
npm link        # puts `margin` on your PATH
# or run it in place: node bin/margin.js …
```

## Usage

```sh
margin serve --ensure
# margin daemon started at http://127.0.0.1:51234 (pid 12345)

margin serve --ensure
# margin daemon already running at http://127.0.0.1:51234 (pid 12345)

margin open ./report.html --agent pi --session abc123
# http://127.0.0.1:51234/d/report-9f3a2c?t=…
```

- `margin serve` runs the daemon in the foreground; `--ensure` detaches it
  into the background. Both are idempotent — safe for any agent to call at
  any time without checking whether a daemon is already running.
- `margin open <file>` registers an HTML file as a **doc** (ensuring the
  daemon first), stamping it with a doc id, the **project** namespace
  (basename of the enclosing git worktree, else the cwd), and the calling
  **agent identity** (`--agent` / `--session`). It prints the doc's
  token-scoped URL on stdout — nothing else — so agents can capture it
  directly. Opening that URL serves the pristine file bytes.
- `--doc <id>` pins an explicit doc id (lowercase letters, digits, `.`,
  `_`, `-`). Re-opening the same file from the same project reuses the same
  derived id.

## How it works

State lives in `~/.margin` (override with `MARGIN_HOME`):

| File            | Contents                                                        |
| --------------- | --------------------------------------------------------------- |
| `daemon.json`   | port + token of the daemon (mode 0600 — the bearer secret)      |
| `journal.jsonl` | append-only JSONL journal: the source of truth                  |
| `daemon.log`    | stdout/stderr of the backgrounded daemon                        |
| `daemon.lock`   | startup lock, held only while a daemon binds and records state  |

- **One daemon per machine** (ADR-0003), bound to `127.0.0.1` only. Every
  route requires the token (`?t=…` or `Authorization: Bearer …`), because
  annotations are instructions an autonomous agent will act on — without the
  token, any website open in a browser could blind-POST forged feedback.
  Token generation and verification are quarantined in `src/auth.js`.
- **The token is minted once** on first run and reused across restarts, so
  doc URLs already handed out keep working. The daemon prefers the recorded
  port for the same reason — and if that port is held by a foreign process
  it **fails loudly** rather than silently moving ports: every doc URL
  already printed points at the recorded port, and a quiet switch would
  strand them all. The error names the port; free it and retry, or remove
  `daemon.json` to mint a fresh port and token (invalidating previously
  printed URLs).
- **The journal is the state.** The doc registry is project-namespaced and
  derived by replaying the journal at startup; the daemon is the only
  process that appends. Crashes never lose registrations.
- Exactly-one-daemon is enforced by serializing startup (probe → bind →
  record) through the lock, so concurrent `serve --ensure` calls converge
  on a single process.

## HTTP surface (this ticket)

| Route                | Auth | Purpose                                  |
| -------------------- | ---- | ---------------------------------------- |
| `GET /healthz`       | yes  | liveness/identity probe                  |
| `POST /api/docs`     | yes  | register a doc (JSON body)               |
| `GET /d/<doc-id>`    | yes  | serve the doc's pristine bytes           |

## Development

```sh
npm test        # builds (tsc) first, then runs node:test on dist/test/
```

Tests drive the daemon through its HTTP interface on an ephemeral port —
the project's one test seam — and assert on responses and the journal on
disk. CLI-level tests spawn `bin/margin.js` against a throwaway
`MARGIN_HOME`, exercising the compiled output exactly as an agent's bash
tool would.
