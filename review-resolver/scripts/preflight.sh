#!/usr/bin/env bash
# preflight.sh — enforce a clean worktree, then check out the PR branch.
#
# A clean git tree is a prerequisite: never resolve review comments on top of
# uncommitted or staged changes. This script refuses to switch branches when
# the tree is dirty so the operator can stash/commit first.
#
# Usage: preflight.sh <pr-number-or-url> [repo-dir]
# Exit codes: 0 ok · 2 not a git repo · 3 dirty worktree · other = gh failure
set -euo pipefail

PR="${1:?Usage: preflight.sh <pr-number-or-url> [repo-dir]}"
REPO_DIR="${2:-$PWD}"
cd "$REPO_DIR"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: $REPO_DIR is not a git repository." >&2
  exit 2
fi

# Clean-tree gate — includes staged, unstaged, and untracked files.
if [ -n "$(git status --porcelain)" ]; then
  echo "BLOCKED: working tree is not clean. Do NOT proceed." >&2
  echo "Resolve these first (commit, stash, or discard):" >&2
  git status --short >&2
  exit 3
fi

echo "Working tree clean. Checking out PR $PR ..."
gh pr checkout "$PR"
echo "OK: now on branch $(git rev-parse --abbrev-ref HEAD)"
