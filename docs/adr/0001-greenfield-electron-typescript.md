# ADR 0001 — LogDeck greenfield em Electron + TypeScript

- **Status:** aceito (12/10/2026)
- **Data:** 12/10/2026
- **Autor:** Matheus Corteletti

## Contexto

O plano original era evoluir o código do **Logui** para o LogDeck. Na leitura do repositório (fase 1):

- `~/Projetos/loggg` estava vazio e sem git.
- O Logui instalado no Mac é um app de terceiro (`com.marcosvidolin.logui`, sandbox de App Store) sem código-fonte público encontrado.

Não dá para fazer fork nem renomear um app fechado de terceiro. Pelo mesmo motivo, também não dá para reaproveitar a integração "AI: Anthropic" nem o parser de níveis dele.

## Decisão

Criar o LogDeck **do zero**, usando os problemas observados no Logui (P1–P5) como especificação e casos de teste. Stack:

- **Electron + TypeScript + React + Vite**, com npm.
- `kubectl` executado por `child_process.spawn` com array de argumentos (sem client-go nem `@kubernetes/client-node`). Assim o app herda do kubectl a autenticação, os plugins `exec` e o `oc login` do OKD, sem tocar em credenciais (G3).
- Pod Shell com `node-pty` + `xterm.js` (P5).
- IA por provedores plugáveis no processo main (Claude Code CLI ou API compatível com OpenAI), sem SDK; chave, quando houver, no Keychain (`safeStorage`). Revisado na fase 7.
- Testes com Vitest e Playwright `_electron`.

O crédito no README passa de "Construído a partir do Logui" para **"Inspirado no Logui"**.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Tauri + TS | binário menor, mas PTY e spawn ficariam em Rust (portable-pty) e o harness ganharia `cargo` e `clippy`; a equipe trabalha em TS |
| Swift/SwiftUI nativo | sem reaproveitar o ecossistema JS de testes, virtualização e terminal; curva maior |
| `@kubernetes/client-node` | teria de ler o kubeconfig e as credenciais no processo do app (choca com G3) e reimplementar plugins de autenticação `exec` |

## Consequências

- O app pesa mais que um nativo (~150 MB) e o RNF3 (< 500 MB) precisa de medição contínua.
- `node-pty` é módulo nativo: exige `electron-rebuild` no build e no CI (`macos-latest`).
- Sem herança de código: tudo nasce com testes (TDD), o que facilita cumprir a cobertura de 90%.
