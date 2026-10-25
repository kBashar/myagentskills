#!/usr/bin/env bash
# Render an SVG to a PNG at the SVG's own width and height (default 1200x630).
# usage: render-svg.sh <in.svg> <out.png>
# Uses rsvg-convert, then inkscape, then headless Chrome/Chromium, whichever is installed first.
set -eu

if [ $# -ne 2 ]; then
  echo "usage: render-svg.sh <in.svg> <out.png>" >&2
  exit 2
fi
in="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
out="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"

tag=$(tr '\n' ' ' < "$in" | grep -oE '<svg[^>]*' | head -1)
w=$(printf '%s' "$tag" | grep -oE ' width="[0-9]+' | grep -oE '[0-9]+$' || true)
h=$(printf '%s' "$tag" | grep -oE ' height="[0-9]+' | grep -oE '[0-9]+$' || true)
w=${w:-1200}
h=${h:-630}

rm -f "$out"
if command -v rsvg-convert >/dev/null 2>&1; then
  rsvg-convert -w "$w" -h "$h" -o "$out" "$in"
elif command -v inkscape >/dev/null 2>&1; then
  inkscape "$in" --export-type=png --export-filename="$out" -w "$w" -h "$h" >/dev/null 2>&1
else
  chrome=""
  for c in google-chrome google-chrome-stable chromium chromium-browser \
           "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; do
    if command -v "$c" >/dev/null 2>&1 || [ -x "$c" ]; then chrome=$c; break; fi
  done
  if [ -z "$chrome" ]; then
    echo "no renderer found: install rsvg-convert, inkscape, or Chrome" >&2
    exit 3
  fi
  timeout 60 "$chrome" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
    --force-device-scale-factor=1 --window-size="$w,$h" --screenshot="$out" "file://$in" >/dev/null 2>&1 || true
fi

if [ ! -s "$out" ]; then
  echo "render failed: $out was not written" >&2
  exit 1
fi
echo "PNG=$out (${w}x${h})"
