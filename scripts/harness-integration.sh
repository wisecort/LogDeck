#!/usr/bin/env bash
# Manual integration run against a disposable kind cluster. Never runs in CI.
# Only read-only kubectl verbs are used by the tests (G1).
set -euo pipefail

cd "$(dirname "$0")/.."

CONTEXT="${LOGDECK_IT_CONTEXT:-kind-logdeck-test}"

if [[ -n "${CI:-}" ]]; then
  echo "❌ harness-integration não roda no CI"
  exit 1
fi

if [[ "$CONTEXT" != kind-* ]]; then
  echo "❌ só contextos kind-* são aceitos (recebido: ${CONTEXT})"
  exit 1
fi

if ! kubectl config get-contexts -o name | grep -qx "$CONTEXT"; then
  echo "❌ contexto ${CONTEXT} não encontrado. Crie com: kind create cluster --name ${CONTEXT#kind-}"
  exit 1
fi

if [[ ! -d tests/cluster ]]; then
  echo "⏭  nenhum teste de cluster ainda (chegam na fase 5)"
  exit 0
fi

LOGDECK_IT_CONTEXT="$CONTEXT" npx vitest run --dir tests/cluster
echo "✅ harness-integration contra ${CONTEXT}"
