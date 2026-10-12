# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Uma entrada por fase.

## [Não lançado]

### Fase 1 — Governança

- Identidade do app: LogDeck (`package.json`, bundle id `io.github.wisecort.logdeck`), licença MIT..
- `SPEC.md` com F1–F7, P1–P5, requisitos não funcionais e fora de escopo.
- `GUARDRAILS.md` (G1–G10 e como cada regra é verificada), `AGENTS.md`, `CLAUDE.md`.
- ADR 0001: greenfield em Electron + TypeScript (código do Logui indisponível).
- `docs/backlog-mvp2.md`.

### Fase 2 — Proteções

- Esqueleto do app Electron + React + Vite (janela, menu e bundle como LogDeck; renderer com sandbox, contextIsolation e CSP).
- `scripts/guardrails.mjs` (G1–G10, sem dependências) com testes; `--hook` para o Claude Code e allowlist com justificativa obrigatória.
- `scripts/harness.sh` (10 etapas, ✅/❌/⚠️), `Makefile`, `.github/workflows/ci.yml` (macos-latest), `.pre-commit-config.yaml`.
- `.claude/settings.json` (deny list + hook) e subagentes `parser-author`, `security-reviewer`, `test-runner`.
- `docs/dependencies.md` com motivo e licença de cada dependência.
- Bundle passa a se chamar `LogDeck.app` (sem `executableName`).

### Fase 3 — Fixtures e testes vermelhos

- Fixtures anonimizadas (G8) de P1–P4: access/error do Apache, PHP-FPM, Laravel, JSON (Monolog/pino/zap), Nginx, Java, startup e um log realista de pod OKD com `--timestamps` (475 linhas, gerado de forma determinística).
- kubectl fake (`tests/bin/kubectl`): contextos, namespaces, pods, `logs -f` com atraso, `--tail`/`--since-time`/`--previous`, erro de autenticação, queda de conexão, exec sem TTY; recusa verbos de escrita (exit 99). Contrato coberto por 15 testes de integração.
- Testes unitários de parsers (7), classify, buffer, search (com ReDoS), signatures, args, contexts e redact, contra stubs que lançam "not implemented".
- Guardrails: hosts em fixtures não confundem mais pacotes Java (`java.net.…`).
- SPEC: heurística com token de nível explícito e regras de continuação de stack trace do Laravel/Java.

### Fase 4 — Núcleo de logs

- 7 parsers plugáveis (JSON/Monolog/pino/zap, Laravel, access Apache/Nginx, error Apache 2.2/2.4, PHP-FPM, error Nginx, heurística) com ordem de tentativa; UNKNOWN em 0,56% das fixtures (meta < 5%).
- `classify`: prefixo `--timestamps` (RFC3339Nano), stack traces multiline, horário do log × k8s com aviso de divergência > 2 s; horário de ingestão nunca exibido (P2).
- `buffer`: ring buffer de 50k (1–500k) com descarte das antigas, contadores por nível e busca por `seq`.
- `search`: texto (padrão) e regex, exclusões, destaque sem HTML; regex com quantificador aninhado recusada e regex patológica abortada em 250 ms num worker descartável (F5.4).
- `signatures`: catálogo do F6 (Timeout Apache → PHP-FPM, Permissão no startup, etc.) e agrupamento genérico por mensagem normalizada.
- Cobertura de `src/logs/`: 99% linhas, 96% branches.

### Fase 5 — Kubernetes

- `args.ts`: builders e portão final `assertReadOnly` (allowlist de verbos, recursos e flags; `--context` obrigatório); nomes DNS-1123; contexto validado contra `get-contexts`.
- `contexts.ts`: contextos só via `config get-contexts`, sem credenciais; aviso de produção (`prod`/`prd`).
- `kubectl.ts`: único `spawn` (sem shell), PATH com Homebrew para apps abertos pelo Finder, mensagens acionáveis (kubectl ausente, sessão expirada, RBAC, cluster inacessível).
- `pods.ts` e `service.ts`: navegação contexto → namespace → pod → container com status efetivo (CrashLoopBackOff, Init:…, Completed), restarts e fallback para o namespace padrão quando o RBAC não permite listar (OKD).
- `stream.ts`: log ao vivo com lotes de 100 ms, reconexão 1/2/5/10 s com `--since-time` e sem linhas duplicadas, `--previous`, erros não recuperáveis sem retry, SIGTERM→SIGKILL no `stop`; `StreamRegistry` encerra tudo ao fechar janela ou app.
- IPC tipado (`src/shared/ipc.ts`) e API do preload; o renderer não monta argumentos do kubectl e só a janela principal pode chamar.
- E2E com kubectl fake: navegação, rejeição de entrada maliciosa vinda do renderer e nenhum kubectl órfão após fechar o app.
