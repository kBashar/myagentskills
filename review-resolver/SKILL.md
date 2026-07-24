---
name: review-resolver
description: Use when given a GitHub PR link or number and asked to go through, triage, investigate, address, or resolve its review comments. Checks out the PR branch (only if the worktree is clean), fetches every review comment, investigates each against the real code with a concrete failure scenario, presents a selectable triage table, then resolves the operator-selected comments and verifies them.
---

# review-resolver

## Overview

Turn a PR's scattered review feedback into resolved code, safely and auditably. The flow is: **gate the worktree → fetch all comments → investigate each in real code → present a triage table → resolve what the operator selects → verify resolution.**

Core principle: **investigate before judging, and let the operator decide what to fix.** Never resolve a comment you haven't traced into the actual code, and never fix comments the operator didn't select.

## Inputs

A GitHub PR **URL** (`https://github.com/owner/repo/pull/123`) or a bare **number** `123`. A bare number resolves against the git repo in the current directory. The target project repo — where the code lives — must be the current directory (or pass its path as the second script argument).

## Workflow

Create one todo per step.

### Step 1 — Preflight: clean-tree gate + checkout (automated)

A clean git tree is a **prerequisite**. Run:

```bash
scripts/preflight.sh <pr-number-or-url> [repo-dir]
```

- Exit **3** = dirty worktree. **STOP.** Show the operator the printed `git status` and tell them to commit, stash, or discard. Do NOT proceed, do NOT stash on their behalf without being asked.
- Exit **2** = not a git repo (wrong directory).
- Exit **0** = tree was clean and the PR branch is now checked out. Continue.

### Step 2 — Fetch all comments (automated)

```bash
scripts/fetch-comments.sh <pr-number-or-url> [repo-dir]
```

Emits one JSON array covering all three GitHub feedback channels — `inline` (line-level code comments, with `path`+`line`+`diff_hunk`), `review` (summary bodies + verdict `state`), and `issue` (general conversation). Save it (e.g. to the scratchpad) and parse it. Thread replies via `in_reply_to`.

Filter out noise before triaging: skip nitpick/approval-only chatter and bot comments unless they raise a real concern. Keep every substantive comment.

### Step 3 — Investigate each comment in the real code

For **each** substantive comment, do not take it at face value:

1. Open the file at `path:line` (use `diff_hunk` for context on inline comments).
2. Understand what the reviewer is actually claiming.
3. Form your own judgement: is it valid, partially valid, or a misunderstanding? Why?
4. Construct a **concrete failure scenario** — specific inputs/state → wrong output/crash — that demonstrates the bug if the comment is valid, or explains why the code is already correct if it isn't.

If you cannot find code matching a comment (already changed, wrong location), note that in your judgement rather than guessing.

### Step 4 — Present the triage table

Show one row per comment with these columns:

| # | Reviewer's comment (brief) | Severity | Your judgement (after investigation) | Example failure scenario |
|---|---|---|---|---|

- **Severity** = what the reviewer signaled (blocking / suggestion / nit / question), inferred from wording and review `state` when not explicit.
- **Your judgement** = your own verdict (valid / partially valid / invalid) with a one-line reason.

Then make the rows **selectable**: call `AskUserQuestion` with `multiSelect: true`, one option per comment (label = `#N: brief`). Add options like "All valid comments" / "All blocking" when helpful. This lets the operator pick which comments to address. Also accept a direct instruction (e.g. "do 1, 3, and 5") in place of the picker.

### Step 5 — Resolve the selected comments

For each selected comment, edit the real code to address the reviewer's **intention**, not just the literal words. Match surrounding style. Keep unrelated changes out. If a selected comment turns out to need a judgement call or trade-off, surface it rather than guessing.

Do not touch comments the operator did not select.

### Step 6 — Verify with a subagent

Dispatch a fresh subagent (Explore or general-purpose) to independently confirm each selected comment was actually resolved as the reviewer intended. Give it: the reviewer's original comment, the file/line, and the diff of your change. It reports per comment: **resolved / partially / not resolved**, with reasoning. Relay its verdict; fix anything it flags before claiming done.

## Quick reference

| Need | Do |
|---|---|
| Clean-tree check + checkout | `scripts/preflight.sh <pr>` (exit 3 = dirty → stop) |
| Get every PR comment as JSON | `scripts/fetch-comments.sh <pr>` |
| Let operator choose comments | `AskUserQuestion` `multiSelect: true`, one option per row |
| Confirm resolution | independent verification subagent |

## Common mistakes

- **Skipping the clean-tree gate.** Never resolve comments over a dirty tree — you can't cleanly separate your fixes from prior work. Honor exit 3.
- **Judging from the comment text alone.** Always open the code and build the failure scenario before filling the judgement column.
- **Fixing everything.** Only address selected comments. Unselected ones stay untouched.
- **Only reading `gh pr view --comments`.** It misses inline review comments and review-summary bodies. Use `fetch-comments.sh`, which pulls all three channels.
- **Claiming done without verification.** Step 6 is not optional; a passing self-check isn't evidence.
