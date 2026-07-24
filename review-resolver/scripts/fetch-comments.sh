#!/usr/bin/env bash
# fetch-comments.sh — collect ALL review feedback on a PR as one normalized JSON array.
#
# GitHub scatters PR feedback across three endpoints; this gathers all of them:
#   - inline : line-level code-review comments (carry path + line + diff_hunk)
#   - review : top-level review summaries and their verdict (state)
#   - issue  : general PR conversation comments
#
# Usage: fetch-comments.sh <pr-number-or-url> [repo-dir]
# Output (stdout): JSON array sorted by time. Each element:
#   { kind, id, in_reply_to, author, path, line, body, state, url, created_at, diff_hunk }
set -euo pipefail

PR="${1:?Usage: fetch-comments.sh <pr-number-or-url> [repo-dir]}"
REPO_DIR="${2:-$PWD}"
cd "$REPO_DIR"

# Resolve owner/repo/number (accepts a bare number OR a full PR URL).
meta="$(gh pr view "$PR" --json number,url)"
NUMBER="$(jq -r '.number' <<<"$meta")"
URL="$(jq -r '.url' <<<"$meta")"
OWNER="$(sed -E 's#https?://[^/]+/([^/]+)/([^/]+)/pull/.*#\1#' <<<"$URL")"
REPO="$(sed -E 's#https?://[^/]+/([^/]+)/([^/]+)/pull/.*#\2#' <<<"$URL")"

# jq -s 'add' flattens gh's per-page arrays into one flat array regardless of
# how many pages --paginate emitted (or if the endpoint returned empty).
inline="$(gh api --paginate "repos/$OWNER/$REPO/pulls/$NUMBER/comments" \
  | jq -s 'add | [ .[] | {kind:"inline", id:.id, in_reply_to:.in_reply_to_id,
      author:.user.login, path:.path, line:(.line // .original_line),
      body:.body, state:null, url:.html_url, created_at:.created_at,
      diff_hunk:.diff_hunk} ]')"

reviews="$(gh api --paginate "repos/$OWNER/$REPO/pulls/$NUMBER/reviews" \
  | jq -s 'add | [ .[] | select(.body != "") | {kind:"review", id:.id,
      in_reply_to:null, author:.user.login, path:null, line:null, body:.body,
      state:.state, url:.html_url, created_at:.submitted_at, diff_hunk:null} ]')"

issue="$(gh api --paginate "repos/$OWNER/$REPO/issues/$NUMBER/comments" \
  | jq -s 'add | [ .[] | {kind:"issue", id:.id, in_reply_to:null,
      author:.user.login, path:null, line:null, body:.body, state:null,
      url:.html_url, created_at:.created_at, diff_hunk:null} ]')"

jq -s 'add | sort_by(.created_at)' <<<"$inline $reviews $issue"
