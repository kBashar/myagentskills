#!/usr/bin/env bash
# snapshot.sh — save every file in the scope before the cut, and the line counts.
#
# The snapshot is the only restore source: the cut never uses git stash,
# checkout or restore. Run it from inside the target repository.
#
# Usage: snapshot.sh <out-dir> [base-ref]
# Writes to <out-dir>:
#   base-ref      the base ref argument (empty = the uncommitted changes)
#   files.txt     the scope files that exist now, one path per line
#   files.tgz     their content now (restore all: tar xzf files.tgz -C <repo>)
#   tracked.patch git diff of the tracked files against the base
#   before.tsv    the output of added-lines.sh
# Exit codes: 0 ok · 2 not a git repo, bad base ref, or out-dir not empty
set -euo pipefail

out="${1:?Usage: snapshot.sh <out-dir> [base-ref]}"
ref="${2:-}"
here="$(cd "$(dirname "$0")" && pwd)"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: not inside a git repository." >&2
  exit 2
fi
repo="$(git rev-parse --show-toplevel)"
cd "$repo"

if [ -e "$out/files.tgz" ]; then
  echo "ERROR: $out already holds a snapshot. Use a new directory." >&2
  exit 2
fi
mkdir -p "$out"

bash "$here/added-lines.sh" "$ref" > "$out/before.tsv"
base=$(sed -n 's/^# base //p' "$out/before.tsv")

printf '%s\n' "$ref" > "$out/base-ref"
git diff --no-renames --binary "$base" -- . > "$out/tracked.patch"
{
  git diff --no-renames --name-only --diff-filter=d "$base" -- .
  git ls-files --others --exclude-standard
} | while IFS= read -r path; do
  [ -f "$path" ] && [ ! -L "$path" ] && printf '%s\n' "$path"
done | sort -u > "$out/files.txt"
tar czf "$out/files.tgz" -T "$out/files.txt"

echo "repo $repo"
echo "snapshot $out ($(wc -l < "$out/files.txt") files)"
echo "restore one file: tar xzf $out/files.tgz -C $repo <path>"
grep '^TOTAL' "$out/before.tsv"
