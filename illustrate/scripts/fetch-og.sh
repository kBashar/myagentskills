#!/usr/bin/env bash
# Download the preview image (og:image, else twitter:image) of each page, to study a site's illustration style.
# usage: fetch-og.sh <out-dir> <page-url>...
# Saves <out-dir>/og-<n>.<ext> and prints "<file> <page-url>", or "none <page-url>" when a page has no preview image.
set -u

if [ $# -lt 2 ]; then
  echo "usage: fetch-og.sh <out-dir> <page-url>..." >&2
  exit 2
fi
out=$1
shift
mkdir -p "$out"

n=0
for page in "$@"; do
  n=$((n + 1))
  img=$(curl -sL --max-time 20 -A 'Mozilla/5.0' "$page" \
    | grep -oE '<meta[^>]*(property|name)="(og:image|twitter:image)"[^>]*>' | head -1 \
    | grep -oE 'content="[^"]+"' | sed -E 's/^content="//; s/"$//; s/&amp;/\&/g')
  if [ -z "$img" ]; then
    echo "none $page"
    continue
  fi
  case $img in
    //*) img="https:$img" ;;
    /*) img="$(printf '%s' "$page" | grep -oE '^https?://[^/]+')$img" ;;
  esac
  tmp="$out/og-$n.part"
  if ! curl -sL --max-time 30 -A 'Mozilla/5.0' -o "$tmp" "$img"; then
    rm -f "$tmp"
    echo "none $page"
    continue
  fi
  case $(file --mime-type -b "$tmp") in
    image/png) ext=png ;;
    image/jpeg) ext=jpg ;;
    image/webp) ext=webp ;;
    image/gif) ext=gif ;;
    image/svg+xml) ext=svg ;;
    *) rm -f "$tmp"; echo "none $page"; continue ;;
  esac
  mv "$tmp" "$out/og-$n.$ext"
  echo "$out/og-$n.$ext $page"
done
