# CLI-first agent interface, no MCP

Margin must work identically across pi, Claude Code, Codex, and OpenCode. We decided the agent-facing interface is a **CLI** (`margin list`, `margin locate`, …) driven through each harness's bash tool, not an MCP server. pi deliberately ships no MCP ("build CLI tools with READMEs"), and a CLI is the one interface every coding agent already has. An MCP wrapper remains possible later as a thin adapter over the same CLI, but nothing in the core depends on it.
