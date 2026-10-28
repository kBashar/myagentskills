#!/usr/bin/env bash
# gone-names.sh — list the public names that the cut deleted or renamed, and
# every file that still uses them.
#
# A name is gone when a source file of the snapshot defined it and no scope
# file defines it now. Names that start with "_" are private and left out.
# The match is by keyword (def, class, function, const, type, ...), so the
# list is a set of candidates: read each one.
#
# Usage: gone-names.sh <snapshot-dir>     (run from inside the repository)
# Output: per gone name, "GONE <name> (<file it was in>)", then the
#         "path:line:text" uses that are left, or "  no uses left".
# Exit codes: 0 ok · 2 not a git repo or no snapshot
set -euo pipefail

snap="${1:?Usage: gone-names.sh <snapshot-dir>}"
here="$(cd "$(dirname "$0")" && pwd)"
[ -f "$snap/files.tgz" ] || { echo "ERROR: no snapshot in $snap." >&2; exit 2; }
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: not inside a git repository." >&2
  exit 2
fi
cd "$(git rev-parse --show-toplevel)"

names() {
  sed -nE \
    -e 's/^[[:space:]]*(export[[:space:]]+)?(default[[:space:]]+)?(pub(\([a-z]+\))?[[:space:]]+)?(async[[:space:]]+)?(def|class|function\*?|fn|func|interface|type|struct|enum|trait|object)[[:space:]]+([A-Za-z_$][A-Za-z0-9_$]*).*/\7/p' \
    -e 's/^export[[:space:]]+(const|let|var)[[:space:]]+([A-Za-z_$][A-Za-z0-9_$]*).*/\2/p' \
    -e 's/^([A-Z][A-Z0-9_]+)[[:space:]]*(:[^=]*)?=.*/\1/p' \
    -e 's/^func[[:space:]]+\([^)]*\)[[:space:]]*([A-Za-z_][A-Za-z0-9_]*).*/\1/p' |
    grep -v '^_' || true
}

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
tar xzf "$snap/files.tgz" -C "$work"

bash "$here/added-lines.sh" "$(cat "$snap/base-ref")" | awk -F'\t' '$3 == "source" { print $4 }' > "$work/.now"
awk -F'\t' '$3 == "source" { print $4 }' "$snap/before.tsv" > "$work/.before"

: > "$work/.had"
while IFS= read -r path; do
  [ -f "$work/$path" ] && names < "$work/$path" | sed "s|\$|	$path|" >> "$work/.had"
done < "$work/.before"
: > "$work/.has"
# A file whose diff the cut emptied leaves the scope, but its names still exist.
sort -u "$work/.before" "$work/.now" | while IFS= read -r path; do
  [ -f "$path" ] && names < "$path" >> "$work/.has"
done
sort -u -o "$work/.has" "$work/.has"

sort -u -t$'\t' -k1,1 "$work/.had" | while IFS=$'\t' read -r name path; do
  grep -qxF "$name" "$work/.has" && continue
  echo "GONE $name ($path)"
  uses=$(git grep -n -I -w --untracked -e "$name" -- . ':!*.lock' ':!*-lock.*' 2>/dev/null | head -20 || true)
  if [ -n "$uses" ]; then printf '%s\n' "$uses" | sed 's/^/  /'; else echo "  no uses left"; fi
done
