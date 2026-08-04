#!/usr/bin/env bash
# preflight.sh — gh gate + target-repo resolution for the ghissue skill.
#
# Usage: scripts/preflight.sh [repo-hint]
#   repo-hint   optional. "owner/name", a bare repo name, or a dictated name
#               such as "portal dash web" (normalised to "portal-web").
#
# Exit codes:
#   0  ready to file. stdout: REPO=<owner/name>, then LABELS: and the label list
#   2  gh unusable (missing or unauthenticated) -> draft-only mode, reason on stdout
#   3  no target repo resolvable -> stop and ask the user which repo
#   4  hint matched several repos -> CANDIDATES: list on stdout, ask the user to pick

set -uo pipefail

say() { printf '%s\n' "$*"; }

emit_ready() {
  say "REPO=$1"
  say "LABELS:"
  gh label list --repo "$1" --limit 100 2>/dev/null || say "(no labels readable for $1)"
  exit 0
}

# 1 --- is gh usable at all? --------------------------------------------------
if ! command -v gh >/dev/null 2>&1; then
  say "GH_UNUSABLE=not-installed"
  say "The GitHub CLI is not on PATH. Install it from https://cli.github.com/ to file directly."
  exit 2
fi

if ! gh auth status >/dev/null 2>&1; then
  say "GH_UNUSABLE=not-authenticated"
  say "gh is installed but not authenticated. Run: gh auth login"
  exit 2
fi

# 2 --- normalise the hint ----------------------------------------------------
# Lowercases, turns a spoken "dash"/"slash" into its symbol, and collapses
# whitespace and underscores into hyphens.
normalise() {
  printf '%s' "$1" |
    tr '[:upper:]' '[:lower:]' |
    sed -E 's#[[:space:]]+dash[[:space:]]+#-#g
            s#[[:space:]]+slash[[:space:]]+#/#g
            s#[[:space:]_]+#-#g
            s#-+#-#g
            s#^-##
            s#-$##'
}

HINT="$(normalise "${1-}")"
CURRENT="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"

# 3 --- no hint: fall back to the current directory's repo --------------------
if [ -z "$HINT" ]; then
  if [ -n "$CURRENT" ]; then
    emit_ready "$CURRENT"
  fi
  say "NO_TARGET_REPO=1"
  say "No repository was named, and the current directory is not a GitHub repository."
  exit 3
fi

# 4 --- explicit owner/name ---------------------------------------------------
case "$HINT" in
  */*)
    RESOLVED="$(gh repo view "$HINT" --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"
    if [ -n "$RESOLVED" ]; then
      emit_ready "$RESOLVED"
    fi
    say "NO_TARGET_REPO=1"
    say "No repository found at '$HINT'."
    exit 3
    ;;
esac

# 5 --- bare name: try the current repo's owner, then the authenticated user ---
OWNERS=()
[ -n "$CURRENT" ] && OWNERS+=("${CURRENT%%/*}")
ME="$(gh api user -q .login 2>/dev/null || true)"
if [ -n "$ME" ] && [ "${OWNERS[0]-}" != "$ME" ]; then
  OWNERS+=("$ME")
fi

if [ ${#OWNERS[@]} -gt 0 ]; then
  for owner in "${OWNERS[@]}"; do
    RESOLVED="$(gh repo view "$owner/$HINT" --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"
    if [ -n "$RESOLVED" ]; then
      emit_ready "$RESOLVED"
    fi
  done
fi

# 6 --- still nothing: search those owners for a near match -------------------
CANDIDATES=""
if [ ${#OWNERS[@]} -gt 0 ]; then
  for owner in "${OWNERS[@]}"; do
    found="$(gh search repos "$HINT" --owner "$owner" --limit 10 --json fullName -q '.[].fullName' 2>/dev/null || true)"
    [ -n "$found" ] && CANDIDATES="${CANDIDATES}${found}"$'\n'
  done
fi
CANDIDATES="$(printf '%s\n' "$CANDIDATES" | grep . | sort -u || true)"
COUNT="$(printf '%s\n' "$CANDIDATES" | grep -c . || true)"

if [ "$COUNT" -eq 1 ]; then
  emit_ready "$CANDIDATES"
fi

if [ "$COUNT" -gt 1 ]; then
  say "AMBIGUOUS=1"
  say "CANDIDATES:"
  printf '%s\n' "$CANDIDATES"
  exit 4
fi

say "NO_TARGET_REPO=1"
say "Nothing matched the repository name '$HINT'."
exit 3
