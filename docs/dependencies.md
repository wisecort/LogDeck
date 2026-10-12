# Dependências

Toda dependência do `package.json` precisa de uma linha aqui (G9). O `scripts/guardrails.mjs` falha se faltar alguma. Versões fixadas (`--save-exact`).

## Runtime

| Pacote | Versão | Licença | Motivo | Fase |
|---|---|---|---|---|
| `react` | 19.3.0 | MIT | UI do renderer | 2 |
| `react-dom` | 19.3.0 | MIT | renderização do React no DOM | 2 |
| `node-pty` | 1.1.0 | MIT | Pod Shell com pseudo-terminal real (P5); N-API, o mesmo binário serve ao Node e ao Electron. O `spawn-helper` vem sem bit de execução e `scripts/fix-node-pty.mjs` (postinstall) corrige | 6 |
| `@xterm/xterm` | 6.0.0 | MIT | terminal no renderer para o Pod Shell | 6 |
| `@xterm/addon-fit` | 0.11.0 | MIT | ajusta colunas/linhas do terminal ao painel e alimenta o resize do PTY | 6 |
| `@tanstack/react-virtual` | 3.14.17 | MIT | lista virtualizada de logs (50k linhas, RNF1) | 6 |
| `@anthropic-ai/sdk` | 0.133.0 | MIT | provedor "API da Anthropic" do F7 pelo SDK oficial (ADR 0002); usado só no processo main | 7 |

## Desenvolvimento e build

| Pacote | Versão | Licença | Motivo | Fase |
|---|---|---|---|---|
| `electron` | 44.7.0 | MIT | runtime desktop (ADR 0001) | 2 |
| `electron-vite` | 5.0.0 | MIT | build/dev de main, preload e renderer | 2 |
| `vite` | 7.3.7 | MIT | bundler; preso na 7.x porque o electron-vite 5 não suporta Vite 8 | 2 |
| `@vitejs/plugin-react` | 5.2.0 | MIT | JSX/Fast Refresh no Vite 7 | 2 |
| `electron-builder` | 26.15.3 | MIT | empacotar o `.app` macOS sem assinatura | 2 |
| `typescript` | 6.0.3 | Apache-2.0 | tipagem `strict`; preso na 6.0 porque o typescript-eslint ainda não suporta TS 7 | 2 |
| `@types/node` | 26.6.5 | MIT | tipos do Node para main/preload/testes | 2 |
| `@types/react` | 19.3.0 | MIT | tipos do React | 2 |
| `@types/react-dom` | 19.3.0 | MIT | tipos do React DOM | 2 |
| `vitest` | 5.0.4 | MIT | testes unitários e de integração | 2 |
| `@vitest/coverage-v8` | 5.0.4 | MIT | cobertura com thresholds de 90% (RNF8) | 2 |
| `@playwright/test` | 1.64.0 | Apache-2.0 | E2E do Electron (`_electron`) | 2 |
| `eslint` | 10.12.0 | MIT | lint | 2 |
| `@eslint/js` | 10.0.1 | MIT | regras base do ESLint | 2 |
| `typescript-eslint` | 8.71.1 | MIT | lint de TypeScript | 2 |
| `eslint-plugin-react-hooks` | 7.1.1 | MIT | regras de hooks do React | 2 |
| `globals` | 17.13.0 | MIT | globais de Node/browser para o ESLint | 2 |

## Vulnerabilidades conhecidas

| Data | Pacote | Severidade | Situação |
|---|---|---|---|
| 12/10/2026 | `global-agent` (via `electron-builder` → `app-builder-lib` → `@electron/get`) | moderada (8 avisos) | só desenvolvimento, fora do app empacotado; `npm audit --omit=dev --audit-level=high` passa. Reavaliar a cada atualização do electron-builder |
