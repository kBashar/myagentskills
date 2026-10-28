# simpla contract

Every editor follows this file: the main agent when it works alone, and each lane. The brief (`brief.md` in the snapshot directory) gives the facts of this repo.

## Goal

Cut the lines that the change adds. The order of preference is **delete >> simplify >> keep as is.**

- Delete every trivial test (rules below).
- Cut the source to the code that the decided behaviour needs.
- A simplification that adds lines is fine only when it removes a branch, a type, a piece of state or a query. Otherwise, always cut.
- Cut code, not layout. Keep the line length, the blank lines and the formatter output of the repo. Run the formatter of the repo on your files when it has one.
- Simplify the comments and docstrings (rules below).

## What to look for, in this order

1. **Delete.**
   - Trivial tests, and the fixtures and helpers that no kept test uses.
   - Functions, classes, parameters, fields and options with no caller and no planned use.
   - Checks that no input can reach: a type check that every caller already satisfies, an empty-input guard in front of a loop that already does nothing, a None check on a value that is never None.
   - History comments, comments that say what the next line does, docstrings that repeat the name and the types.
   - Unused imports and variables.
2. **Reuse.** New code that does the job of a helper the repo already has. Call the helper and delete the copy. Search the shared modules and the files next to the change first.
3. **Simplify.** Inline a helper with one caller when that cuts lines. Merge copies that differ a little. Drop state that other state gives you, and variables that only pass a value on. Parametrize tests that differ only in data. Shrink fixtures to the data that the tests read.
4. **Altitude.** The same special case in several places becomes one change in the shared place.
5. **Efficiency.** Make a cheaper form only when it is also shorter or the same length.
6. **Keep as is.**

## Scope

- **In scope:** the untracked files, and the added lines of the modified tracked files. `git diff <base> -- <file>` shows them.
- **Out of scope:** committed code outside the diff hunks. Do not refactor it, even when it is ugly. You may call it.
- **Docs and plans** (`*.md` and the like) are sources, not targets. Do not trim them.
- **Generated files** (lock files, snapshots, build output): do not edit them and do not revert them.
- **Database migrations:** keep what they do. Trim only their comments and generated banners.
- **Lanes:** edit only the files in your list. A change that another file needs goes in your findings file: the file, the line, the change and why. Before you rename a name or change its signature, `grep -rn <name>` over the whole repo. Do not rename or change a name that a file outside your list uses.

## The behaviour is fixed

Keep every status code, exit code, response field, error type, default value, stored value, accepted input and the order of the checks. The brief lists the sources of truth.

- **A trivial test goes. The behaviour that it touches stays.** "Pydantic rejects an extra field" is a trivial test, but `extra="forbid"` is behaviour: delete the test and keep the setting. The same holds for a length limit, a strip of spaces, a range check and an enum.
- **A check that outside input can reach is behaviour.** Outside input is a user, a file, a request body, a command-line argument or a queue message. Keep the check. Delete only checks that no caller and no input can reach.
- **"No decided rule needs it" is not a reason to delete behaviour.** The decided rules choose which tests stay. They do not choose which behaviour stays.
- **Message texts.** A user-visible text may change when the cut deletes the code that made it (example: a library validator replaces a custom one). A text that a source of truth states stays as it is. List every changed text under "Visible changes" in your report.
- **Passing tests do not prove the behaviour stayed.** You may have deleted the test that guarded it. Check the sources of truth.

## Do not delete a function that later work needs

- A function with a caller in non-test code stays. Exception: inline it when that cuts lines.
- A function with no caller in non-test code (tests do not count): search the planned-work docs in the brief for its name. A planned use: keep it and one test of it. A public API doc that lists it: keep it. No planned use and no API doc: delete it and its tests.

## Trivial tests: delete them

A test is trivial when it does one of these:

1. It proves a library or framework feature, not this code. Examples: the validation library rejects a wrong type, a wrong enum value, an extra field, or `""` under a length limit; the web framework returns 400 or 422 for a missing field; a frozen dataclass refuses a write; the argument parser prints help.
2. It reads back a constant, a flag, a setting default, a description text, a deprecation flag, a route registration or an export list.
3. It only checks that a mock received the arguments that the code passes straight through.
4. It repeats a rule that another kept test already proves. Typical: the same rule at the unit level (mocks) and at the integration level (a real database). Keep the test that proves the rule best. A rule in a query is proved by the real database. A pure function is proved by a unit test. Cases that run the same branch with other values are one case. A case at the edge of a rule (the value where the result changes, such as "exactly the units on hand") is not a repeat: keep it in the parametrized test of that rule.
5. It tests a private helper that a kept test of the public function already covers.

Keep exactly one test for each decided rule that this code implements. The brief lists the decided rules. Merge tests with parametrization (`pytest.mark.parametrize`, `it.each`, table tests) when that cuts lines. Delete a test module that has no test left.

A decided rule whose only test is trivial (rule 2: the test reads back a flag): delete the test, and name the rule under "Decided rules with no test now" in your report.

A kept test that cannot fail (it compares a value with itself, or it asserts nothing that the rule decides): fix it so that it proves the rule, and run the mutation check on it.

## Comments and docstrings

The comment rules of the repo win (the brief names them). Use these defaults when the repo has none:

- Zero comments by default. A comment says why, never what the next line does.
- No history: no "now", "new", "replaces", "used to", "previously", "unlike the old". An issue number only where it points a reader to a rule.
- Public function, class and module: a one-line docstring. Add lines only for a fact that the name and the types do not give. A private helper gets a docstring only when its name is not enough.
- Test docstrings and test comments: delete them unless the test name cannot carry the rule.
- Text that the program shows or publishes is behaviour: command-line help, API descriptions, schema field descriptions, error messages. Keep it. You may cut a sentence that repeats another sentence of the same text.

## Tests and verification

- **Before you edit:** run your tests once (the baseline). Use only your own test resources (the brief gives them).
- **After your edits:** run your tests and every other test module that imports a file you changed. Every test that passed before must pass, or you deleted it on purpose under a rule above.
- **A failure in a file that you do not own**, and not from your change: another lane can be in the middle of an edit. Run it again once, a minute later. If it still fails, report it. Do not edit the file.
- **Mutation check:** for each kept rule test that you rewrote or merged, copy the source file to your scratch directory under its repo path (two files can have the same name), break the guarded line, run the test and see it fail. Then restore the copy and `cmp` the file with it. For Python, set `PYTHONDONTWRITEBYTECODE=1`, so that no stale `.pyc` of the broken file runs after the restore. Mutate only files that you own. A guarded line in a file of another lane: list it as "mutation pending".
- **A test that cannot run here** (no database, no service, no credentials): delete it only under a trivial-test rule. Otherwise leave it exactly as it is. Do not rewrite it, merge it or move its imports, because you cannot verify the result. Report it as "not run".
- **Lint:** run the linter and the type checker of the repo on every file you changed. Fix every undefined name and every unused import that your cut made.

## Never

- Never `git stash`, `git commit`, `git push`, `git checkout -- <file>`, `git restore`, `git reset`, `git clean`, or a write with `gh`. Other worktrees can share the stash stack. Restore a file only from your own scratch copy or from the snapshot.
- Never edit a file outside your lane list.
- Never add a test for code that the cut did not change.

## Report (your final message)

1. Added lines before → after for your files. Tracked: `git diff <base> --numstat -- <files>`. Untracked: `wc -l`.
2. Deleted tests, grouped by trivial-test rule number, with a count for each rule.
3. Source cuts, one line each.
4. Behaviour or visible text that changed, or "none".
5. Each decided rule whose only test you deleted, or "none".
6. Names that you renamed or deleted, and the files outside your list that use them.
7. Tests: the commands, and the pass and fail counts before and after. The mutation checks you ran. The tests you could not run.
8. The path of your findings file, or "none".
