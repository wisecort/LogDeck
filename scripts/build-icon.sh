#!/usr/bin/env bash
# Builds build/icon.png and build/icon.icns from an SVG using macOS tools only (Quick Look, sips, iconutil).
# Usage: scripts/build-icon.sh [build/icon-src/a-deck.svg]
set -euo pipefail
SRC="${1:-build/icon-src/a-deck.svg}"
WORK="$(mktemp -d)"
qlmanage -t -s 1024 -o "$WORK" "$SRC" >/dev/null
PNG="$WORK/$(basename "$SRC").png"
cp "$PNG" build/icon.png
SET="$WORK/icon.iconset"
mkdir "$SET"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$PNG" --out "$SET/icon_${size}x${size}.png" >/dev/null
  sips -z $((size * 2)) $((size * 2)) "$PNG" --out "$SET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$SET" -o build/icon.icns
echo "✅ build/icon.png e build/icon.icns gerados de $SRC"
