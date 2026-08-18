# Margin

A local feedback loop: a reader annotates an agent-generated HTML doc in the browser, and any coding agent (pi, Claude Code, Codex, OpenCode) picks up those annotations through a shared CLI.

## Language

**Doc**:
A self-contained HTML document produced by an agent, registered with margin and served by the daemon with the injected layer added at serve time.
_Avoid_: page, file, artifact

**Annotation**:
A reader's note attached to a selected passage of a doc. One-way: it travels from reader to agent; the agent's reply happens in the agent's own chat, not in the doc.
_Avoid_: comment, thread, message, reply

**Anchor**:
The fuzzy reference tying an annotation to its passage — the exact quote, ~40 characters of context on each side, and the heading trail — resolved lazily against the current doc, never stored as a position.
_Avoid_: position, offset, selector

**Heading trail**:
The chain of section headings above an annotation's passage, captured at selection time (e.g. "Transport → Daemon & queue"). The human-readable handle used in conversation about an annotation.

**Anchor confidence**:
The outcome of resolving an anchor against the current doc: `exact`, `normalized`, `partial`, or `lost`. Lost anchors are kept and displayed, never silently dropped.

**Daemon**:
The single loopback-only localhost process that serves registered docs, stores annotations, and pushes live updates to open pages. One per machine, shared by all projects and agents.

**Journal**:
The append-only JSONL record of every annotation and status change; the source of truth, surviving crashes and restarts.
_Avoid_: database, queue

**Drain**:
An agent reading the un-read annotations via the CLI, which marks them `read`. Read means "an agent has seen this" — nothing more is inferred.

**Dismiss**:
The reader's manual removal of an annotation from active views once handled. Pure bookkeeping; margin never judges resolution.
_Avoid_: resolve, close, complete

**Registration**:
Telling the daemon about a doc at generation time — file path, doc id, project, and agent identity — so it can be served with the injected layer.

**Agent identity**:
The agent name + session id pair stamped on a doc at registration, enabling annotations to be filtered and (later) pushed to the right agent session.

**Injected layer**:
The JavaScript the daemon adds when serving a doc — selection composer, underline highlights, annotation drawer, live reload. It is never written into the source file.
