# One global daemon, loopback-only, token-scoped URLs

One margin daemon per machine serves all docs from all projects and agents (registry is project-namespaced; filtering is metadata, not process boundaries). It binds `127.0.0.1` only. Every doc URL carries a random token (`?t=…`), generated on first run and stored alongside the port in the daemon state file.

The token exists because annotations are not passive notes — they are instructions an autonomous coding agent will read and act on. A localhost port accepts connections from any local process, including any website open in the browser (blind cross-origin POSTs go through; CORS only blocks reading). Without the token, a malicious tab could inject forged "user feedback" into the agent's context. The token is quarantined in its own module so security logic never spreads across the codebase.
