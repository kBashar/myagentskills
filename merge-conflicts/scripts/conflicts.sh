#!/usr/bin/env bash
# conflicts.sh — read-only merge conflict facts for the merge-conflicts skill.
#
# Simulates merging <second> into <first> with `git merge-tree --write-tree`,
# which never touches the working tree, the index, or any ref. For each
# conflicted file it prints the conflict type, the commits on each branch
# since the merge base, every conflict hunk (diff3 style, labelled with the
# branch names), and a blame of each side's lines limited to <base>..<branch>.
#
# Usage: conflicts.sh <first> <second> [repo-dir]
#   first    the branch that receives the merge (e.g. main)
#   second   the branch that merges into it (e.g. feature/login)
#
# Exit codes: 0 ok (CONFLICTED_FILES=0 means a clean merge) · 2 bad input · 3 git older than 2.38
set -uo pipefail

FIRST="${1:?Usage: conflicts.sh <first> <second> [repo-dir]}"
SECOND="${2:?Usage: conflicts.sh <first> <second> [repo-dir]}"
cd "${3:-$PWD}" || exit 2

say() { printf '%s\n' "$*"; }

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  say "ERROR: $PWD is not a git repository."
  exit 2
fi

# merge-tree --write-tree needs git 2.38+.
ver=$(git version | sed -E 's/^git version ([0-9]+)\.([0-9]+).*/\1 \2/')
read -r major minor <<<"$ver"
if [ "$major" -lt 2 ] || { [ "$major" -eq 2 ] && [ "$minor" -lt 38 ]; }; then
  say "ERROR: $(git version) is too old. This script needs git 2.38 or later."
  exit 3
fi

for ref in "$FIRST" "$SECOND"; do
  if ! git rev-parse --verify --quiet "$ref^{commit}" >/dev/null; then
    say "ERROR: '$ref' is not a branch, tag, or commit in this repository."
    exit 2
  fi
done

if ! BASE=$(git merge-base "$FIRST" "$SECOND"); then
  say "ERROR: '$FIRST' and '$SECOND' have no common history."
  exit 2
fi
BASE_SHORT=$(git rev-parse --short "$BASE")

say "FIRST=$FIRST $(git rev-parse --short "$FIRST")"
say "SECOND=$SECOND $(git rev-parse --short "$SECOND")"
say "BASE=$BASE_SHORT $(git log -1 --format='%ad %an  %s' --date=short "$BASE")"
nbases=$(git merge-base --all "$FIRST" "$SECOND" | wc -l)
[ "$nbases" -gt 1 ] && say "NOTE: $nbases merge bases (criss-cross history). git merged them into a virtual base."
say "LEGEND: in BLAME lines, ^<sha> = line unchanged since the merge base."

# 1 --- simulate the merge -----------------------------------------------------
# -z output: <tree> NUL <path> NUL ... NUL NUL, then per message:
# <n> NUL <path>*n NUL <type> NUL <text> NUL
mapfile -d '' -t parts < <(git -c merge.conflictStyle=diff3 merge-tree --write-tree -z --name-only "$FIRST" "$SECOND")
TREE="${parts[0]}"
files=()
i=1
while [ "$i" -lt "${#parts[@]}" ] && [ -n "${parts[$i]}" ]; do
  files+=("${parts[$i]}"); i=$((i + 1))
done
i=$((i + 1))
msg_paths=(); msg_texts=()
while [ "$i" -lt "${#parts[@]}" ]; do
  n="${parts[$i]}"; i=$((i + 1))
  paths=("${parts[@]:$i:$n}"); i=$((i + n))
  type="${parts[$i]}"; text="${parts[$((i + 1))]}"; i=$((i + 2))
  [ "$type" = "Auto-merging" ] && continue
  for p in "${paths[@]}"; do msg_paths+=("$p"); msg_texts+=("${text%$'\n'}"); done
done

# Unique conflicted paths, in order.
mapfile -t files < <(printf '%s\n' "${files[@]}" | awk 'NF && !seen[$0]++')
say "CONFLICTED_FILES=${#files[@]}"
[ "${#files[@]}" -eq 0 ] && exit 0

# 2 --- helpers ---------------------------------------------------------------
# blame_side <branch> <path> <block-text>: blame the block's lines in <branch>.
blame_side() {
  local branch="$1" path="$2" block="$3" hits start end k
  if [ -z "$block" ]; then
    say "BLAME $branch: no lines on this side ($branch removed or never had the base text here)."
    return
  fi
  k=$(printf '%s\n' "$block" | wc -l)
  # Find every start line where the whole block matches the branch's file.
  hits=$(awk -v k="$k" 'NR==FNR { b[++n]=$0; next }
                         { f[++m]=$0 }
                         END { for (s=1; s+k-1<=m; s++) { ok=1
                                 for (j=1; j<=k; j++) if (f[s+j-1]!=b[j]) { ok=0; break }
                                 if (ok) print s } }' \
         <(printf '%s\n' "$block") <(git show "$branch:$path" 2>/dev/null))
  if [ -z "$hits" ]; then
    say "BLAME $branch: lines not found in $branch:$path. Run git log $BASE_SHORT..$branch -p -- $path to trace them."
    return
  fi
  # No pipes into early-exit readers here: under pipefail, a SIGPIPE on a
  # large input turns a match into a failure.
  start=${hits%%$'\n'*}; end=$((start + k - 1))
  nhits=$(grep -c . <<<"$hits")
  if [ "$nhits" -gt 1 ]; then
    say "BLAME $branch (lines $start-$end of $branch:$path; first of $nhits identical blocks):"
  else
    say "BLAME $branch (lines $start-$end of $branch:$path):"
  fi
  git blame --date=short -L "$start,$end" "$BASE..$branch" -- "$path" 2>&1
}

# 3 --- per file ----------------------------------------------------------------
# Conflicts are numbered across the whole report; render.sh keys the
# implications by these numbers.
conflict=0
for path in "${files[@]}"; do
  say ""
  say "=== FILE $path"
  for j in "${!msg_paths[@]}"; do
    [ "${msg_paths[$j]}" = "$path" ] && say "TYPE: ${msg_texts[$j]}"
  done
  for side in "$FIRST" "$SECOND"; do
    say "COMMITS $side ($BASE_SHORT..$side, this file):"
    git log --format='  %h %ad %an  %s' --date=short "$BASE..$side" -- "$path"
  done

  merged=$(git cat-file -p "$TREE:$path" 2>/dev/null) || merged=""
  if ! grep -q '^<<<<<<< ' <<<"$merged"; then
    conflict=$((conflict + 1))
    say "--- CONFLICT $conflict: whole file, no conflict markers (binary, delete, or rename conflict)"
    say "Diff of each side since the base (max 60 lines):"
    for side in "$FIRST" "$SECOND"; do
      say "DIFF $BASE_SHORT..$side:"
      git diff "$BASE" "$side" -- "$path" | head -60
    done
    continue
  fi

  hunk=0; state=""; ours=""; theirs=""; text=""; start=0; ln=0
  while IFS= read -r line || [ -n "$line" ]; do
    ln=$((ln + 1))
    case "$state:$line" in
      ":<<<<<<< "*)
        hunk=$((hunk + 1)); state=ours; start=$ln; ours=""; theirs=""; text="$line" ;;
      ours:"||||||| "*) state=base; text+=$'\n'"$line" ;;
      ours:"=======" | base:"=======") state=theirs; text+=$'\n'"$line" ;;
      theirs:">>>>>>> "*)
        text+=$'\n'"$line"
        conflict=$((conflict + 1))
        say "--- CONFLICT $conflict: hunk $hunk of this file, merged lines $start-$ln"
        say "$text"
        blame_side "$FIRST" "$path" "$ours"
        blame_side "$SECOND" "$path" "$theirs"
        state="" ;;
      ours:*) text+=$'\n'"$line"; ours+="${ours:+$'\n'}$line" ;;
      base:*) text+=$'\n'"$line" ;;
      theirs:*) text+=$'\n'"$line"; theirs+="${theirs:+$'\n'}$line" ;;
    esac
  done <<<"$merged"
done
say ""
say "TOTAL_CONFLICTS=$conflict"
