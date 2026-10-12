#!/usr/bin/env bash
# LogDeck harness: the same pipeline runs locally (`make harness`) and in CI.
# Stops at the first failing step and prints a ✅/❌ summary.
#
# Env:
#   HARNESS_SKIP_INSTALL=1     skip `npm ci` (local iteration only; CI never sets it)
#   HARNESS_REQUIRE_GITLEAKS=1 fail instead of warn when gitleaks is missing (CI)
#
# Runs on macOS, Linux and Windows (Git Bash). On Windows the fakes in tests/bin are built as .exe
# first (scripts/build-test-bins.mjs, Node SEA).
set -euo pipefail

cd "$(dirname "$0")/.."

case "$(uname -s)" in
  Darwin) OS=mac ;;
  Linux) OS=linux ;;
  MINGW* | MSYS* | CYGWIN*) OS=win ;;
  *) OS=unknown ;;
esac

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

build_linux() {
  npm run build
  npm run package:linux
  [[ -x release/linux-unpacked/logdeck ]] || { echo "release/linux-unpacked/logdeck não encontrado"; return 1; }
}

build_win() {
  npm run build
  npm run package:win
  [[ -f release/win-unpacked/LogDeck.exe ]] || { echo "release/win-unpacked/LogDeck.exe não encontrado"; return 1; }
}

build_app() {
  case "$OS" in
    mac) build_mac ;;
    linux) build_linux ;;
    win) build_win ;;
    *) echo "sistema não suportado: $(uname -s)"; return 1 ;;
  esac
}

# Windows cannot run the "#!" fakes in tests/bin: build them as .exe first (Node SEA).
with_fakes() {
  if [[ "$OS" == "win" && ! -f tests/bin/kubectl.exe ]]; then
    node scripts/build-test-bins.mjs || return 1
  fi
  "$@"
}

e2e() {
  if [[ "$OS" == "linux" && -z "${DISPLAY:-}" ]] && command -v xvfb-run >/dev/null 2>&1; then
    xvfb-run -a npm run test:e2e
  else
    npm run test:e2e
  fi
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
step "6. Testes de integração (kubectl fake)" with_fakes npm run test:integration
step "7. Build do app (${OS}, sem assinatura)" build_app
step "8. E2E" with_fakes e2e
step "9. Auditoria de dependências" audit
step "10. Segredos (gitleaks)" secrets

summary
