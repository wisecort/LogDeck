#!/usr/bin/env bash
# Builds build/icon.png and build/icon.icns from an SVG with macOS tools (Quick Look, sips, iconutil) and Node.
# Usage: scripts/build-icon.sh [build/icon-src/a-deck.svg]
set -euo pipefail
SRC="${1:-build/icon-src/a-deck.svg}"
WORK="$(mktemp -d)"
qlmanage -t -s 1024 -o "$WORK" "$SRC" >/dev/null
# Quick Look draws on white: cut the rounded square out so the corners are transparent.
node scripts/icon-mask.mjs "$WORK/$(basename "$SRC").png" build/icon.png
PNG=build/icon.png
SET="$WORK/icon.iconset"
mkdir "$SET"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$PNG" --out "$SET/icon_${size}x${size}.png" >/dev/null
  sips -z $((size * 2)) $((size * 2)) "$PNG" --out "$SET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$SET" -o build/icon.icns
bash scripts/build-appx-assets.sh
echo "✅ build/icon.png e build/icon.icns gerados de $SRC"
