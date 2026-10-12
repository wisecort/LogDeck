#!/usr/bin/env bash
# LogDeck harness: the same pipeline runs locally (`make harness`) and in CI.
# Stops at the first failing step and prints a ✅/❌ summary.
#
# Env:
#   HARNESS_SKIP_INSTALL=1     skip `npm ci` (local iteration only; CI never sets it)
#   HARNESS_REQUIRE_GITLEAKS=1 fail instead of warn when gitleaks is missing (CI)
set -euo pipefail

cd "$(dirname "$0")/.."

RESULTS=()
STEP_WARNING=""

summary() {
  echo
  echo "━━━━━━━━ Resumo do harness ━━━━━━━━"
  printf '%s\n' "${RESULTS[@]}"
}

step() {
  local label="$1"
  shift
  echo
  echo "━━━━━━━━ ${label}"
  local start=$SECONDS
  STEP_WARNING=""
  if "$@"; then
    if [[ -n "$STEP_WARNING" ]]; then
      RESULTS+=("⚠️  ${label}: ${STEP_WARNING}")
    else
      RESULTS+=("✅ ${label} ($((SECONDS - start))s)")
    fi
  else
    local code=$?
    RESULTS+=("❌ ${label} (código ${code})")
    summary
    exit "$code"
  fi
}

install() {
  if [[ "${HARNESS_SKIP_INSTALL:-0}" == "1" ]]; then
    echo "⏭  HARNESS_SKIP_INSTALL=1, usando node_modules existente"
    STEP_WARNING="ignorada (HARNESS_SKIP_INSTALL=1)"
  else
    npm ci --no-fund --no-audit
  fi
}

build_mac() {
  npm run build
  CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:mac
  local plist
  plist=$(find release -maxdepth 4 -path '*LogDeck.app/Contents/Info.plist' | head -1)
  [[ -n "$plist" ]] || { echo "LogDeck.app não encontrado em release/"; return 1; }
  local bundle_id
  bundle_id=$(plutil -extract CFBundleIdentifier raw "$plist")
  echo "Bundle id: ${bundle_id}"
  [[ "$bundle_id" == "io.github.wisecort.logdeck" ]]
}

audit() {
  npm audit --omit=dev --audit-level=high
}

secrets() {
  if command -v gitleaks >/dev/null 2>&1; then
    gitleaks git --no-banner --redact .
  elif [[ "${HARNESS_REQUIRE_GITLEAKS:-0}" == "1" ]]; then
    echo "gitleaks é obrigatório neste ambiente e não está instalado"
    return 1
  else
    echo "⚠️  gitleaks não instalado (brew install gitleaks); etapa ignorada"
    STEP_WARNING="gitleaks não instalado, varredura ignorada"
  fi
}

step "1. Instalação limpa" install
step "2. Lint" npm run lint
step "3. Typecheck" npm run typecheck
step "4. Guardrails" node scripts/guardrails.mjs
step "5. Testes unitários + cobertura" npm run test:unit
step "6. Testes de integração (kubectl fake)" npm run test:integration
step "7. Build do app macOS (sem assinatura)" build_mac
step "8. E2E" npm run test:e2e
step "9. Auditoria de dependências" audit
step "10. Segredos (gitleaks)" secrets

summary
