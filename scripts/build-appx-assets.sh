#!/usr/bin/env bash
# Builds the Microsoft Store (appx/MSIX) logos in build/appx/ from build/icon.png with sips (macOS).
# Each logo at scale 100 and 200; the wide tile pads the square icon with transparency.
# Usage: scripts/build-appx-assets.sh
set -euo pipefail
PNG=build/icon.png
OUT=build/appx
mkdir -p "$OUT"
square() { # name size
  sips -z "$2" "$2" "$PNG" --out "$OUT/$1.png" >/dev/null
  sips -z $(($2 * 2)) $(($2 * 2)) "$PNG" --out "$OUT/$1.scale-200.png" >/dev/null
}
square StoreLogo 50
square Square44x44Logo 44
square Square150x150Logo 150
for scale in 1 2; do
  suffix=$([ "$scale" = 2 ] && echo .scale-200 || echo "")
  h=$((150 * scale))
  sips -z "$h" "$h" "$PNG" --out "$OUT/Wide310x150Logo$suffix.png" >/dev/null
  sips -p "$h" $((310 * scale)) "$OUT/Wide310x150Logo$suffix.png" --out "$OUT/Wide310x150Logo$suffix.png" >/dev/null
done
echo "✅ logos da Microsoft Store em $OUT/"
