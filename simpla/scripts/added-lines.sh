#!/usr/bin/env bash
# added-lines.sh — count the lines that a change adds, per file.
#
# Scope: the untracked files, plus the added lines of the tracked files.
# Without a base ref, tracked files compare with HEAD (the uncommitted changes).
# With a base ref, they compare with the merge base of <base-ref> and HEAD
# (the whole branch since <base-ref>, plus the uncommitted changes).
#
# Usage: added-lines.sh [base-ref]
# Output: "# base <sha|HEAD>", then one line per file "<added>\t<deleted>\t<kind>\t<path>"
#         (kind = source | test | doc | generated), then one TOTAL line per kind.
#         "all" = source + test. Binary files are left out.
# Exit codes: 0 ok · 2 not a git repo or bad base ref
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: not inside a git repository." >&2
  exit 2
fi
cd "$(git rev-parse --show-toplevel)"

base=HEAD
if [ -n "${1:-}" ]; then
  if ! base=$(git merge-base "$1" HEAD 2>/dev/null); then
    echo "ERROR: no merge base for '$1' and HEAD." >&2
    exit 2
  fi
fi

kind() {
  local name=${1##*/}
  case "$name" in
    package-lock.json|npm-shrinkwrap.json|yarn.lock|pnpm-lock.yaml|bun.lockb|poetry.lock|uv.lock|Pipfile.lock|Cargo.lock|Gemfile.lock|composer.lock|go.sum|*.snap|*.min.js|*.min.css)
      echo generated; return ;;
  esac
  case "$1" in
    */__snapshots__/*|__snapshots__/*|dist/*|build/*) echo generated; return ;;
  esac
  case "$name" in
    *.md|*.mdx|*.rst|*.adoc|*.txt) echo doc; return ;;
  esac
  case "$name" in
    test_*.py|*_test.py|conftest.py|*_test.go|*.test.*|*.spec.*|*Test.java|*Tests.java|*Test.kt|*Tests.cs)
      echo test; return ;;
  esac
  case "$1" in
    test/*|tests/*|*/test/*|*/tests/*|__tests__/*|*/__tests__/*|spec/*|*/spec/*) echo test; return ;;
  esac
  echo source
}

rows=$(
  {
    git diff --no-renames --numstat "$base" -- . | while IFS=$'\t' read -r added deleted path; do
      [ "$added" = "-" ] && continue
      printf '%s\t%s\t%s\t%s\n' "$added" "$deleted" "$(kind "$path")" "$path"
    done
    git ls-files --others --exclude-standard -z | while IFS= read -r -d '' path; do
      [ -f "$path" ] && [ ! -L "$path" ] || continue
      if [ ! -s "$path" ]; then
        lines=0
      elif grep -Iq . "$path"; then
        lines=$(grep -c '' "$path")
      else
        continue
      fi
      printf '%s\t0\t%s\t%s\n' "$lines" "$(kind "$path")" "$path"
    done
  } | sort -t$'\t' -k3,3 -k4,4
)

echo "# base $base"
[ -n "$rows" ] && printf '%s\n' "$rows"
printf '%s\n' "$rows" | awk -F'\t' '
  NF == 4 { a[$3] += $1; d[$3] += $2; if ($3 == "source" || $3 == "test") { A += $1; D += $2 } }
  END {
    split("source test doc generated", kinds, " ")
    for (i = 1; i <= 4; i++) printf "TOTAL\t%s\tadded=%d\tdeleted=%d\n", kinds[i], a[kinds[i]], d[kinds[i]]
    printf "TOTAL\tall\tadded=%d\tdeleted=%d\n", A, D
  }'
