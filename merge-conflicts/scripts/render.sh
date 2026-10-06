#!/usr/bin/env bash
# render.sh — build the merge-conflicts report page and open it in a browser.
#
# Reads the implications on stdin, runs conflicts.sh for the facts, and writes
# one self-contained HTML page OUTSIDE the repository:
#   ${TMPDIR:-/tmp}/merge-conflicts/<repo>--<second>-into-<first>.html
# The page holds repository code, so it is written with mode 600.
#
# Usage: render.sh <first> <second> [repo-dir] <<'EOF'
#        1 title: login() start
#        1 first drops: The null guard stays. The token refresh is lost.
#        1 second throws: login(null) throws a TypeError at user.token.
#        1 both noload: Two const record lines give a SyntaxError.
#        EOF
# One line per entry: <conflict number> <title|first|second|both> [status]: <text>
# Status: runs · drops · silent · throws · noload · impossible · unknown
# The format is plain lines, not JSON: Claude Code blocks a Bash command that
# has quote characters inside { }, which every JSON object has.
# Set MERGE_CONFLICTS_NO_OPEN=1 to skip the browser.
#
# Exit codes: 0 ok · 2 bad input · 3 git too old · 4 malformed implication lines
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIRST="${1:?Usage: render.sh <first> <second> [repo-dir] < implications}"
SECOND="${2:?Usage: render.sh <first> <second> [repo-dir] < implications}"
REPO_DIR="${3:-$PWD}"

say() { printf '%s\n' "$*"; }
b64() { base64 | tr -d '\n'; }  # GNU and BSD base64 both read stdin

impl=$(cat)

facts=$(bash "$HERE/conflicts.sh" "$FIRST" "$SECOND" "$REPO_DIR")
status=$?
if [ "$status" -ne 0 ]; then say "$facts"; exit "$status"; fi
total=$(sed -n 's/^TOTAL_CONFLICTS=//p' <<<"$facts")
if [ -z "$total" ] || [ "$total" -eq 0 ]; then
  say "No conflicts: no page to build."
  exit 0
fi

# Check the implication lines against the conflict numbers.
report=$(awk -v total="$total" '
  /^[[:space:]]*$/ || /^#/ { next }
  match($0, /^[0-9]+ title: ./) { n = $1; seen[n] = 1; next }
  match($0, /^[0-9]+ (first|second|both) (runs|drops|silent|throws|noload|impossible|unknown): ./) {
    n = $1; seen[n] = 1; have[n, $2] = 1; next }
  { bad = bad "\n  " $0 }
  END {
    if (bad != "") print "MALFORMED:" bad
    for (n in seen) if (n + 0 < 1 || n + 0 > total) extra = extra " " n
    for (n = 1; n <= total; n++) for (k = 1; k <= 3; k++) {
      c = k == 1 ? "first" : k == 2 ? "second" : "both"
      if (!((n, c) in have)) missing = missing " " n "." c }
    if (extra != "") print "WARNING: unknown conflict numbers:" extra
    if (missing != "") print "WARNING: missing entries:" missing
  }' <<<"$impl")
if grep -q '^MALFORMED:' <<<"$report"; then
  say "$report"
  say "ERROR: these lines do not match '<n> <first|second|both> <status>: <text>' or '<n> title: <text>'. Fix them and run render.sh again."
  exit 4
fi
[ -n "$report" ] && say "$report"

repo=$(basename "$(git -C "$REPO_DIR" rev-parse --show-toplevel 2>/dev/null || echo repo)")
slug() { printf '%s' "$1" | tr -c 'A-Za-z0-9._-' '-'; }
dir="${TMPDIR:-/tmp}/merge-conflicts"
out="$dir/$(slug "$repo")--$(slug "$SECOND")-into-$(slug "$FIRST").html"

umask 077
mkdir -p "$dir" || exit 2
tpl=$(cat "$HERE/../assets/report.html") || exit 2
facts64=$(printf 'REPO=%s\n%s\n' "$repo" "$facts" | b64)
impl64=$(printf '%s' "$impl" | b64)
# base64 text has no characters that bash pattern replacement treats specially.
tpl=${tpl/__FACTS_B64__/$facts64}
tpl=${tpl/__IMPL_B64__/$impl64}
printf '%s\n' "$tpl" > "$out" || exit 2

say "PAGE=$out"
say "CONFLICTS=$total"
if [ -z "${MERGE_CONFLICTS_NO_OPEN:-}" ]; then
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$out" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then open "$out" >/dev/null 2>&1 &
  else say "Open the page in a browser: file://$out"; fi
fi
exit 0
