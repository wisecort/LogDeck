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

### Fase 6 — Interface

- Interface React: navegação contexto → namespace → pod → container, faixa vermelha de produção (G5), status Live/Reconectando/Pausado/Encerrado/Erro, opções `tail`/`desde`/`--previous`, pausa sem perder linhas, aviso de linhas descartadas.
- F4: filtro por nível com contadores (clique alterna, ⌥+clique isola).
- F5: busca texto/regex com ⌘F, ⌘G/⇧⌘G, diferenciar maiúsculas, exclusões e destaque só com texto (sem HTML); regex em Blob Worker com limite de 250 ms.
- P3: presets de exclusão por contexto+namespace salvos em `userData` (“Ocultar health checks” ativo por padrão) e colapso de linhas repetidas (×121 no fixture).
- F6: painel de erros e timeouts com contagem, primeira/última ocorrência, filtro por grupo e seleção (para o F7).
- P5: Pod Shell com `node-pty` + `xterm.js`, resize repassado ao PTY, confirmação nativa em produção feita no processo main; shells encerrados ao fechar janela/app.
- ANSI removido antes do parsing (F3.6); lista virtualizada com seguimento do fim.
- Novas dependências: `node-pty`, `@xterm/xterm`, `@xterm/addon-fit`, `@tanstack/react-virtual` (ver `docs/dependencies.md`); postinstall corrige o bit de execução do `spawn-helper` do node-pty.
- E2E da UI: fluxo principal (ERROR → FPM → “Timeout Apache → PHP-FPM”), P3, regex catastrófica, faixa de produção, `--previous` e shell com TTY.
- Arquitetura: núcleo de logs na thread da UI (SPEC §2 atualizado); painel F6 usa o relógio do kubectl.
- Correção: o E2E `app.spec` abria o app sem o kubectl fake e, com a UI nova, rodou `kubectl version --client` e `config get-contexts` reais (leitura local do kubeconfig, sem contato com cluster). Todos os E2E agora usam kubectl e kubeconfig fake, com rede de segurança no `playwright.config.ts`.

### Fase 7 — IA ("Explicar esses erros")

- Três provedores no processo main (ADR 0002): **Claude Code CLI** (assinatura; `--tools ""`, `--no-session-persistence`, `--strict-mcp-config`, `--permission-mode dontAsk`, stdin, `cwd` temporário vazio), **API da Anthropic** (`@anthropic-ai/sdk`, `claude-opus-5-5`, `effort: medium`, `fallbacks: "default"`, tratamento de recusa) e **API compatível com OpenAI** (Ollama, LM Studio, DeepSeek, OpenRouter, Groq, personalizado; HTTPS fora de localhost).
- Chaves no Keychain do macOS (`/usr/bin/security`), nunca no renderer; "Testar provedor" sem logs.
- `redact.ts` (JWT, Bearer, senhas, segredos, AWS/GCP, chaves privadas, credenciais em URL, e-mails, IPs internos opcionais), refeito no main; payload de até 200 linhas / 32 KB com as linhas mais recentes de cada grupo.
- Preview obrigatório com destino; envio único por id de preview (expira em 10 min); log delimitado em `<logs>` e declarado como dado no prompt de sistema.
- Resposta exibida como texto: comandos de escrita sugeridos ficam riscados, com aviso e sem botão de copiar; diffs só podem ser salvos em arquivo local escolhido pelo usuário.
- Guardrails: rede e SDK de IA só em `src/ai/providers/`; bloqueio de `bypassPermissions`/`acceptEdits`/`--dangerously-*`/`--tools default`; exceção justificada para a lista de verbos do detector.
- Testes com `claude`, `security` e servidores HTTP fakes; testes manuais autorizados com o Claude Code real e a API da Anthropic (texto fictício do fixture) passaram.
- Harness 100% verde: 512 unitários, 92 de integração, 12 E2E; cobertura de `redact.ts` 100%.
