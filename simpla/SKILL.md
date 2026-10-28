---
name: simpla
description: Cut the lines of code that a change adds - the uncommitted changes, or a branch since a base ref. Deletes trivial tests and code that is not needed first, simplifies second, keeps as is last. The behaviour stays the same.
argument-hint: "[base-ref]"
disable-model-invocation: true
---

# simpla

## Overview

Cut the lines that a change adds. The order of preference is **delete >> simplify >> keep as is.** The behaviour stays the same: every test that passed before passes after, or simpla deleted it on purpose under a trivial-test rule.

simpla is not `/simplify`. `/simplify` is a quality pass that keeps the tests. simpla is a line-count cut: it deletes first, trivial tests too.

These sit in this skill's base directory (the path shown when the skill loads):

- `contract.md`: the rules that every editor follows, you and each lane. Read it now.
- `scripts/`: `snapshot.sh`, `added-lines.sh` and `gone-names.sh`. Run them with `bash` from inside the target repository.

## Input

| Command | Scope |
|---|---|
| `/simpla` | The uncommitted changes: modified tracked files against `HEAD`, plus the untracked files. |
| `/simpla <base-ref>` | The branch since the merge base with `<base-ref>`, plus the uncommitted changes. |

The first word is the base ref when `git rev-parse --verify --quiet "<word>^{commit}"` succeeds. Other text after the command is an instruction from the user. It wins over this skill.

## Workflow

Make one todo for each step.

### 1. Measure and snapshot

Pick a new directory outside the repository: the session scratchpad when there is one, else `${TMPDIR:-/tmp}/simpla-<repo>-<time>`. Below, `<snap>` is that directory.

```bash
bash <skill-dir>/scripts/snapshot.sh <snap> [base-ref]
```

The script saves every file in the scope and counts the added lines per file and per kind (source, test, doc, generated). The snapshot is the only restore source. Then tell the user the count in one line, and continue without a wait: "The change adds N lines (S source, T tests). The cut starts now."

### 2. Read the rules and the decided behaviour

Read these and note their paths:

- The rules of the repo: `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING`, docs about style, comments and tests, and the linter and type-checker config.
- The sources of truth for the behaviour: the plan, spec, issue or PR text of this change; the text that the code shows or publishes (API descriptions, command-line help, docstrings that state a contract); and the tests that guard decided rules.
- The plans for later work: task lists, roadmaps, TODOs. They decide which unused functions stay.
- How to run the tests: the commands, the services they need (a database, a queue), and how to start a throwaway copy of each.

If no plan or spec exists, the sources of truth are the public text in the code, the tests and the words of the user. A behaviour that no source names still stays.

Write `<snap>/brief.md` from the template below. The brief holds the facts of this repo. `contract.md` stays generic.

### 3. Baseline

1. Run the tests that cover the scope: the test files in the scope, plus every test module that imports a changed module. Save the result of each test (`pytest -rA`, `vitest --reporter=verbose`, `go test -v`) to `<snap>/baseline.txt`. A test that fails now is a known failure.
2. Count the test cases (for example `pytest --collect-only -q`).
3. Run the linter and the type checker on the changed files. Save the counts.
4. A test that cannot run here: start a throwaway service when the repo shows how (for example with docker). Else write it under "Cannot run here" in the brief.

### 4. Work alone or in lanes

| Added source + test lines (step 1) | Do |
|---|---|
| Fewer than 1,500 | Work alone. Follow `contract.md` yourself, then go to step 7. |
| 1,500 or more | Split the files into lanes (step 5). Then run the cross-file round (step 6). |

A lane is one subagent that owns a fixed list of files.

- Put a source file and its tests in the same lane. Put files that change together (a schema, its service and its route) in the same lane.
- Aim at 800 to 1,500 added lines for each lane, and 2 to 7 lanes.
- Give each shared file to exactly one lane. A shared file is a file that several lanes use: `conftest.py`, fixtures, test helpers, a package `__init__`, or a test file that tests the sources of two lanes.
- When lanes run tests at the same time, give each lane its own test resources: its own database, port and scratch directory.
- Write the lanes, their files and their resources into the "Lanes" section of the brief before you start them.

### 5. Run the lanes

Start all lanes in one message, in the background, each with `model: opus`. Do not give a lane worktree isolation: a new worktree starts from `HEAD` and does not hold the uncommitted changes. Use this prompt:

```text
You are lane <X> of a simpla line cut in <repo path>. Run every command from there.
Read first: <skill-dir>/contract.md (follow it exactly), then <snap>/brief.md.
Your files (edit only these): <file list>
Your tests and test resources: <command, port or database, scratch directory>
Findings file for changes in other files: <snap>/findings-<X>.md
Start each subagent that you spawn with model opus.
End with the report that contract.md defines.
```

Add hints only from facts that you measured: the files with the most added lines, or a unit test and an integration test that cover the same rule. Do not repeat the contract in the prompt. Do not edit the files of a running lane.

When a lane reports:

1. Read its diff against the snapshot. Check each cut against the sources of truth in the brief. A cut that removes an exit code, a status code, an error type, a field, a default, an accepted input or a check that a source names is a behaviour change. Put it back, and say so in your report.
2. Read its findings file. Apply each finding after every lane that owns a touched file has finished.

### 6. Cross-file round (only after two or more lanes)

A lane sees only its own files. Start one read-only reviewer with `model: opus` on the whole scope. Give it these angles:

- **Reuse:** new code in one file that repeats code in another changed file or in a committed shared module. Name the one helper to keep.
- **Cross-file simplification:** a parameter that every caller passes the same way; a wrapper with one caller in another file; a value that two functions compute across a call; a type or field that no reader uses; a public function with no caller left (check the planned-work docs).
- **Altitude:** the same special case in several files that one change in the shared place replaces.
- **Efficiency:** only when the cheaper form is also shorter or the same length.

The reviewer returns at most 15 findings, ranked by lines saved. Each finding names the files and lines, the change, every caller and test that uses the names, and the line delta.

Apply the findings yourself, or give them to lanes that own fixed files again. For each finding, count the added lines of the touched files before and after the edit. Keep the edit when the count falls. Undo it otherwise. Exception: keep an edit that adds lines when it removes a query, a branch or a type, and name it in the report.

### 7. Verify

1. Run the baseline test set again and compare each test. Each test that passed before passes now, or a lane (or you) deleted it under a trivial-test rule. A known failure stays a known failure. Fix any other failure, or undo the cut from the snapshot.
2. Run the linter and the type checker on every changed file. The counts must not rise above the baseline.
3. Run `bash <skill-dir>/scripts/gone-names.sh <snap>`. It lists each public name that the snapshot defined and no scope file defines now, with the files that still use it. A use in code or in a test is a break: fix it. A use in a doc, a plan or a file list is stale: name it in the report.
4. Run `bash <skill-dir>/scripts/added-lines.sh [base-ref]` for the after numbers.
5. Stop the throwaway services. Delete the temp files that you made outside `<snap>`.

### 8. Report

Your final message uses this shape. Write "none" in a section that has nothing.

```markdown
<One line: added lines before → after (−x%). The behaviour did not change. Nothing is committed.>

|                     | Before | After |
|---------------------|--------|-------|
| Added lines, source |        |       |
| Added lines, tests  |        |       |
| Test cases          |        |       |

**Deleted tests:** by trivial-test rule (1-5), with a count for each rule.
**Source cuts:** one line each.
**Visible changes:** each message text or output that a user or client can see, before and after.
**Decided rules with no test now:** each rule.
**Renamed or deleted names:** `old` → `new` or "deleted", and each doc, plan or list that still uses it (path:line). Offer to update them.
**Generated files:** left as they are. If one looks like noise, give the command that reverts it. Do not run it.
**Verification:** the commands; pass and fail counts before → after; known failures; the mutation checks; the tests that did not run.
**Skipped:** each finding that you did not apply, and why.
```

## Brief template

```markdown
# simpla brief: <repo>, <date>

Scope: uncommitted changes | branch since <ref> (merge base <sha>)
Snapshot: <snap> (restore one file: tar xzf <snap>/files.tgz -C <repo> <path>)

## Sources of truth for the behaviour, in this order
1. <path or text>: <what it decides>

## Decided rules (keep one test each)
- R1. <rule> (<source>)

## Planned later work (a function with a planned use stays)
- <path>

## Repo rules
- Comments: <path, or "none: use the contract defaults">
- Style, lint, type check: <paths and commands>
- Text that must stay (API descriptions, command-line help): <what and where>

## Tests
- Run: <command>
- Services: <how to start a throwaway copy; the port of each lane>
- Baseline: <snap>/baseline.txt. Known failures: <list>
- Cannot run here: <list, or none>

## Lanes
- A: <files>. Findings: <snap>/findings-A.md
```

## Common mistakes

| Mistake | Correct action |
|---|---|
| Run `/simplify` in place of simpla | `/simplify` keeps the trivial tests. Follow this workflow. |
| Delete `extra="forbid"`, a length limit or a strip of spaces because "no decided rule needs it" | Delete the trivial test of it. Keep the behaviour. |
| Revert a noisy lock file with `git checkout --` | That discards the user's work. Name the file in the report with the revert command. |
| Rewrite or merge a test that cannot run here | Delete it under a trivial-test rule, or leave it exactly as it is. Report it as "not run". |
| Trust the lane reports | A lane once removed a documented exit code and deleted its test. Read each lane diff against the sources of truth. |
| Stop after the rename | Plans and docs that use the old name mislead the next session. Run `gone-names.sh` and report each stale use. |
| Run two lanes on one test database | One lane breaks the tests of the other. Give each lane its own resources. Re-run once before you report a failure in a file of another lane. |
| Fix the ugly committed code next to a hunk | It is out of scope. Leave it. |

## Red flags: stop

- You are about to run `git stash`, `checkout`, `restore`, `reset` or `commit`.
- You are about to delete a function with no caller, and you did not search the planned-work docs.
- You are about to keep a trivial test "because it is cheap".
- You deleted a check that a user, a file or a request can reach.
- A test that you rewrote did not fail once under a mutation.
