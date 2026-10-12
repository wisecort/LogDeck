#!/usr/bin/env bash
# Points the Homebrew cask (github.com/wisecort/homebrew-tap) at a published LogDeck release.
# Usage: scripts/update-tap.sh 1.2.0 [--dry-run]
# Needs: gh (to read the release checksums) and SSH push access to the tap.
set -euo pipefail
VERSION="${1:?usage: scripts/update-tap.sh <version> [--dry-run]}"
DRY="${2:-}"
SUMS="$(gh release download "v${VERSION}" -R wisecort/LogDeck -p 'SHA256SUMS-macOS.txt' -O -)"
ARM="$(awk -v f="LogDeck-${VERSION}-arm64.dmg" '$2 == f { print $1 }' <<<"$SUMS")"
INTEL="$(awk -v f="LogDeck-${VERSION}-x64.dmg" '$2 == f { print $1 }' <<<"$SUMS")"
[[ ${#ARM} -eq 64 && ${#INTEL} -eq 64 ]] || { echo "checksums dos .dmg não encontrados na release v${VERSION}"; exit 1; }

WORK="$(mktemp -d)"
git clone -q git@github.com:wisecort/homebrew-tap.git "$WORK/tap"
CASK="$WORK/tap/Casks/logdeck.rb"
sed -i.bak -E \
  -e "s/^  version \"[^\"]+\"/  version \"${VERSION}\"/" \
  -e "s/(sha256 arm: +\")[0-9a-f]{64}/\1${ARM}/" \
  -e "s/(intel: +\")[0-9a-f]{64}/\1${INTEL}/" "$CASK"
rm -f "$CASK.bak"
git -C "$WORK/tap" --no-pager diff
if [[ "$DRY" == "--dry-run" ]]; then
  echo "(dry-run: nada enviado)"
  exit 0
fi
git -C "$WORK/tap" -c user.name="Matheus Corteletti" -c user.email="61605704+wisecort@users.noreply.github.com" commit -qam "feat(logdeck): update to ${VERSION}"
git -C "$WORK/tap" push -q origin main
echo "✅ cask logdeck atualizado para ${VERSION}"
