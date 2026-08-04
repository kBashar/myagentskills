---
name: ghissue
description: Use when asked to create, file, open, or raise a GitHub issue — including turning a bug report, a feature request, or a just-shipped backend change into a companion issue in another repository.
---

# ghissue

## Overview

File a GitHub issue whose body is **written for humans first**. Someone who does not contribute to the codebase — a PM, a designer, a new joiner — must be able to scan it in about fifteen seconds and come away with the intent, the goal, and the impact. An implementer must come away with a clear direction.

Core principle: **brief, simple, comprehensive.** Brevity is a budget you spend deliberately, not a licence to omit what the reader needs.

## Workflow

Create one todo per step.

### Step 1 — Preflight (automated)

```bash
scripts/preflight.sh [repo-hint]
```

Pass a repo hint whenever the request names one ("open this in the web frontend"). Branch on the exit code:

| Exit | Meaning | Do |
|---|---|---|
| 0 | Ready. Prints `REPO=owner/name` then the repo's labels | Continue; keep both |
| 2 | `gh` missing or unauthenticated | **Draft-only mode** (below). Do not stop |
| 3 | No target repo resolvable | Stop. Ask which repo, then re-run |
| 4 | Hint matched several repos | Ask the user to pick from `CANDIDATES:` |

**Draft-only mode:** run steps 2–4 and 5, write the body to a file, print it, and hand over the path so the user can paste it into GitHub. Skip labels. A missing `gh` costs you the filing, not the issue.

### Step 2 — Classify: bug or not

This decides one thing only: whether `## Steps to reproduce` exists. Ask when genuinely unclear. Do not infer a bug from the words "broken", "slow", or "doesn't work" — a request to *add* filtering is a feature even when the complaint sounds like a fault.

### Step 3 — Quick scan, then ask

Read the relevant code so present state is fact, not recollection. Timebox it.

**When something material is still unknown after the scan — ask the user now.** Unknowns belong in the conversation, not in the issue. An open question written into the body is a question every future reader has to re-answer.

That includes **every example value headed for the API changes table.** Ask here; do not derive them while drafting and disclose the derivation later.

When missing example values are the *only* thing blocking you, draft and print the rest anyway — hold the API changes table back and put the question beside the draft. The user reviews what you have while answering. Never fill the table provisionally, not even with a caveat.

### Step 4 — Draft

Body per the contract below. Title states the outcome in plain language; no `[BUG]`/`[FEAT]` prefix unless the repo's existing issues already use one.

Labels come **only** from the label list `preflight.sh` printed. Never invent a name, and never pick one because it "exists in every repo".

### Step 5 — Print the draft and stop

Print the complete title and body, headed by:

```
Target: owner/repo
Labels: bug, frontend
```

Then **stop and wait**. The target line exists so a wrong repo resolution is caught here rather than after filing.

### Step 6 — File

```bash
gh issue create --repo <owner/name> --title "<title>" --body-file <path> --label <labels>
```

`--body-file`, never `--body` — shell quoting mangles markdown. Report the URL.

## The issue body

The body is these sections, in this order, and nothing else:

```markdown
## Problem            <- 1 sentence, 2 at most: what's wrong or missing, and who feels it
## Goal               <- <=5 sentences: what we want instead, and the approach
## Present state      <- <=5 sentences or bullets: how it works today
## Steps to reproduce <- bug issues only
## API changes        <- only when the issue crosses a frontend/backend boundary
```

A heading that is not on this list does not go in the body. That includes acceptance criteria, open questions, out-of-scope notes, implementation notes, and per-audience sections.

**Budget: about 200 words.** When the content will not fit, the issue is too big — propose splitting it rather than writing denser prose.

**The budget is a default, not a wall.** When the user asks for more depth, expand without arguing and without re-litigating brevity. It exists to stop *you* padding, not to stop them asking.

## Writing rules

**Test every sentence:** would someone who has never opened this codebase understand it? File paths, symbol names, and hooks name things without explaining them.

> `fetchOrders()` in `src/api/orders.ts` takes no arguments and hardcodes the path with no query string; `useEffect(..., [])` fires once on mount.

becomes

> The orders page asks the server for the customer's entire history once, when the page opens, and offers no way to narrow it.

**Goal states the outcome, not the implementation.** Which files to touch, which hooks to use, how to cancel a stale request — that is the assignee's work.

> Extract the status union into an exported type, widen `fetchOrders` to accept params, add an `AbortController` to the effect cleanup, persist selection via `useSearchParams`.

becomes

> Add a status filter to the orders page that asks the server for just that status, so the list stays short.

**Steps to reproduce** (bugs only): numbered, one line each, about five, ending in observed vs expected. If the user has not given them, ask — never invent plausible-looking steps.

## API changes

When a frontend issue consumes a new endpoint, changed parameters, or a changed response shape:

| Endpoint | Change | Example |
|---|---|---|
| `GET /api/orders` | new optional param `status` | `?status=shipped` |
| `GET /api/orders` | response adds `shippedAt` | `"shippedAt": "2026-08-04T10:00:00Z"` |

Then one line per change on what it means for the UI.

**Every example value must come from a source you can name** — the user's own words, the backend's code, its PR or commit, or its API docs. Deriving a value from a sibling field's shape is not a source. Neither is a value that "must" be ISO-8601 because something nearby is.

Missing even one value makes this a Step 3 question. Ask before drafting, not at the approval gate. **A disclosed guess is still a guess:** the implementer copies the table, not your caveat.

Never `<value>`, `...`, or `TBD` either. This section's whole job is saving the implementer a round trip.

## The approval gate

**Never run `gh issue create` before the user has seen the draft and said go.** Printing the draft and filing in the same turn is a violation.

These are the reasons for skipping it. None hold:

| Rationalization | Reality |
|---|---|
| "Filing an issue is reversible and editable" | Reversible is not invisible. It notifies subscribers, and the first version is what people read. |
| "The ask was unambiguous" | Approval is on the *draft's content*, not on whether to file. Only the user knows if it reads right. |
| "Unknowns are better captured in the issue than resolved up front" | An open question in the body is a question every reader inherits. Ask in Step 3. |
| "The assignee will confirm the contract with the backend anyway" | Then the issue saved nobody anything. Get the values first. |
| "I inferred the value and said so, which is honest" | Honest, and still wrong. The table gets copied; the caveat does not travel with it. Inference is not a source. |
| "This label exists in every repo, so the command can't fail" | Not failing is not the same as correct. Use the list preflight printed. |
| "The PM and designer read these, so I'll add sections for them" | Per-audience sections serve nobody. Plain language in the standard sections serves everyone. |

**Red flags — stop:**

- About to run `gh issue create` in the same turn you drafted
- Writing a heading that is not one of the five
- Reaching for a file path or symbol name to explain something
- Typing "Open questions", "Acceptance criteria", or "Note:"
- Putting a value in the API table that you worked out rather than read or were told
- Body is past 200 words and the user never asked for more

## Quick reference

| Need | Do |
|---|---|
| Gate + resolve target repo + labels | `scripts/preflight.sh [repo-hint]` |
| `gh` missing or logged out | Draft-only mode — write the body to a file, hand over the path |
| Repo named in the request | Pass it as the hint; confirm via the `Target:` line |
| Unknown API value | Ask before drafting; never `<placeholder>` |
| File it | `gh issue create --body-file`, only after explicit approval |

## Common mistakes

- **Present state from memory.** Read the code, or ask. Never describe what you assume is there.
- **Goal as a design doc.** Outcome and approach; the implementation belongs to whoever picks it up.
- **Guessing labels** when the real list is sitting in preflight's output.
- **Repro steps on a feature request**, because the complaint sounded like a fault.
- **Treating a missing `gh` as a dead end.** Draft-only mode still delivers the issue.
