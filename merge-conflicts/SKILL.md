---
name: merge-conflicts
description: Use when asked to analyze, list, preview, or explain the merge conflicts between two git branches before merging - who changed the conflicting lines and when, and what happens if one side, the other side, or both are kept.
disallowed-tools: Edit, Write, NotebookEdit
---

# merge-conflicts

## Overview

Report every conflict a merge of two branches would produce, where each side came from, and what each resolution does — as a page in the browser plus a short overview in the chat. **Analysis only:** the repository must be byte-for-byte unchanged afterwards — same files, index, branches, and HEAD. The one file the skill writes is the report page, which `render.sh` puts in `${TMPDIR:-/tmp}/merge-conflicts/`, outside the repository.

## Inputs

Two branches. `<first>` receives the merge, `<second>` merges into it ("merge `feature/login` into `main`" → first = `main`, second = `feature/login`). Remote refs such as `origin/main` work as given. If only one branch is named, `<first>` is the current branch (`git branch --show-current`) — say so in the report. If the direction is unclear, ask.

## Read-only rule

Use only these git subcommands: `merge-tree`, `merge-base`, `log`, `show`, `blame`, `diff`, `grep`, `rev-parse`, `cat-file`, `branch --show-current`. Use Read/Grep/Glob freely. Run the two bundled scripts with `bash`.

If you need information that only another command gives (`fetch`, `checkout`, `merge`, `stash`, …), stop and ask the user, naming the command and why. Analyze the local refs as they are; the report header shows which commits you analyzed.

## Workflow

1. **Collect the facts.** Run the script from the target repo (`scripts/` is in this skill's directory). Pass `repo-dir` only when the repo is elsewhere, as an absolute path:

   ```bash
   bash scripts/conflicts.sh <first> <second> [repo-dir]
   ```

   Exit 2 = bad input (message says which); exit 3 = git older than 2.38. Show the message and stop. `CONFLICTED_FILES=0` = clean merge; report that and stop.

   Each conflict starts with `--- CONFLICT <n>:`; `<n>` numbers the conflicts across the whole report. Per conflicted file the output gives `TYPE` and the `COMMITS` on each side since the merge base; per conflict, the diff3 text (sections labelled with the branch names) plus a `BLAME` of each side's lines. `^<sha>` in a blame line = unchanged since the merge base, not part of that side's change.

2. **Work out each outcome.** Read the surrounding code (`git show <branch>:<path>`) and `git grep` usages on the branches when the result depends on other code. Write each command with literal branch and file names, chained with `&&` — `git show main:src/app.js && git show feature/login:src/app.js`. Shell loops and variables fail in zsh (`$b:s…` is a modifier) and need a permission prompt in Manual mode. Define the three resolutions exactly:
   - **Take `<first>`** — keep the `<first>` block, drop the `<second>` block.
   - **Take `<second>`** — the reverse.
   - **Take both** — the `<first>` block, then the `<second>` block, markers and base section removed (an editor's "Accept Both"). Describe that literal text's result. If it only works in the other order or after a hand edit, add that as one more sentence.

   For a conflict without markers (modify/delete, rename, binary), describe what each choice leaves in the tree.

   Give each outcome one status:

   | Status | Use when the result… |
   |---|---|
   | `runs` | loads and works; picking one of two values for the same setting is `runs` |
   | `drops` | works, but loses a change the other branch made (a fix, a feature, a key) |
   | `silent` | works, but one value silently replaces another (duplicate key, last definition wins) |
   | `throws` | loads, but a reachable path fails at runtime |
   | `noload` | does not parse, compile, or import |
   | `impossible` | cannot exist (one file both kept and deleted) |
   | `unknown` | depends on code the repository does not show; say what is missing |

3. **Build the page.** Pass the implications on stdin, one line per entry: `<n> first|second|both <status>: <text>`, plus an optional `<n> title: <text>` naming the function or block the conflict sits in. Quote the heredoc delimiter (`<<'EOF'`) so the shell leaves `$` and backticks in the text alone:

   ```bash
   bash scripts/render.sh <first> <second> [repo-dir] <<'EOF'
   1 title: login() start
   1 first drops: The null guard stays. The token refresh from feature/login is lost.
   1 second throws: login(null) throws a TypeError at user.token.
   1 both noload: Two const record lines give a SyntaxError.
   EOF
   ```

   Each text is one line of one or two sentences and names branches by name. Code, authors, dates, and commits come from git; do not copy them into the lines. Write no quote characters between `{` and `}` — Claude Code blocks such a command as "brace with quote character"; write `{ cache: false }`, not `{ "cache": false }`. Every conflict needs its three lines. If the script prints `WARNING:` or exits 4, fix the lines and run it again. On success it prints `PAGE=<path>` and opens the page.

4. **Write the chat report** in this shape:

   ````markdown
   ## Merge conflicts: `<second>` into `<first>`

   `<first>` <sha> · `<second>` <sha> · merge base <sha> (<date>, <subject>)
   <N> files, <M> conflicts. Page: `<PAGE path>`

   | # | File | Take `<first>` | Take `<second>` | Take both |
   |---|---|---|---|---|
   | 1 | `<path>` (<title>) | <status>: <a few words> | … | … |
   ````

   Every side is named by its branch name — never "ours", "theirs", "incoming", "current", "left", or "right". The report contains facts and outcomes only; it ends after the table. The details live on the page; do not repeat them in the chat. If the user asks for the report in a file, give the page path; this skill writes no other files.

## Common mistakes

- **Simulating with a real merge** (`git merge --no-commit`, a scratch checkout, a worktree). `conflicts.sh` already simulates the merge without touching anything.
- **Calling a hand-combined version "take both".** "Take both" is the literal concatenation; a better combination is one extra sentence.
- **Crediting base lines to a branch.** Lines marked `^<sha>` in BLAME existed before both branches.
- **Truncated history.** Do not page `blame` or `log` output with `head`/`sed -n` to save space; the script already narrows it to the conflicting lines.
- **An unquoted heredoc** (`<<EOF`). The shell expands `$name` and backticks inside the text; write `<<'EOF'`.
- **Writing the lines to a file first.** `Write` is blocked and a redirect from a file outside the repo is refused; pass the lines in the heredoc.
