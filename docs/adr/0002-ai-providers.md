# ADR 0002 — Provedores de IA sem API paga por padrão

- **Status:** aceito (12/10/2026)
- **Data:** 12/10/2026
- **Autor:** Matheus Corteletti
- **Relacionado:** SPEC F7, GUARDRAILS G2/G6/G7, ADR 0001

## Contexto

O plano original do F7 era chamar a API da Anthropic com o SDK oficial e uma chave no Keychain. Essa API é **cobrada por uso (tokens)**, à parte de qualquer assinatura do claude.ai. A equipe prefere não depender de uma API paga para uma funcionalidade opcional ("Explicar esses erros").

Situação da máquina de desenvolvimento em 12/10/2026:

- Claude Code CLI 2.1.296 instalado, autenticado pelo **claude.ai (assinatura)**, sem `ANTHROPIC_API_KEY`;
- Codex CLI 0.158 instalado;
- Ollama não instalado.

## Decisão

O LogDeck chama a IA por **provedores plugáveis**, sempre no processo main, escolhidos pelo usuário nas Preferências. O MVP 1 traz três:

1. **Claude Code CLI** (`claude -p`), que usa o login do usuário. Com login de assinatura (Pro/Max), não há cobrança por chamada: o uso entra na cota do plano. Com login por chave de API, volta a ser cobrado por token.
2. **API compatível com OpenAI** (`POST {base}/chat/completions` via `fetch`, sem SDK). Cobre provedores locais e gratuitos (Ollama, LM Studio) e hospedados (DeepSeek, OpenRouter, Groq, ou qualquer URL compatível).
3. **API da Anthropic**, pelo SDK oficial `@anthropic-ai/sdk` (orientação da Anthropic: SDK oficial, não shim compatível com OpenAI). Cobrada por token; entrou no MVP 1 em 12/10/2026 a pedido do usuário, que já tem uma chave com saldo baixo e expiração. Modelo padrão `claude-opus-5-5` (configurável), `effort: "medium"` e `fallbacks: "default"` para recusas.

Chaves ficam no Keychain do macOS em itens próprios, lidos e gravados pelo `/usr/bin/security`. Limitação conhecida: ao **gravar** pela tela de Preferências, a chave passa como argumento do `security` por alguns milissegundos (visível em `ps` para o mesmo usuário); a leitura não expõe a chave.

Nenhum teste automático (harness/CI) chama IA de verdade: os testes usam um `claude` fake em `tests/bin/` e um servidor HTTP fake em `127.0.0.1`.

### Proteções do Claude Code CLI (é um agente, não só chat)

Flags confirmadas no `claude --help` da versão 2.1.296:

| Flag | Motivo |
|---|---|
| `-p --output-format json` | modo não interativo, saída estruturada |
| `--tools ""` | desliga todas as ferramentas: uma injeção no log não consegue ler arquivos nem executar comandos (G7) |
| `--no-session-persistence` | não grava a conversa em `~/.claude/projects` |
| `--strict-mcp-config` | ignora servidores MCP configurados pelo usuário |
| `--disable-slash-commands` | sem skills |
| `--permission-mode dontAsk` | nunca pede ou concede permissão |
| `--system-prompt <fixo>` | prompt do LogDeck (log é dado, não instrução) |

Além das flags: o payload vai pelo **stdin**, o `cwd` é uma pasta temporária vazia apagada no fim, há timeout de 120 s e o argv é conferido por `assertClaudeArgs`. O `guardrails.mjs` barra `bypassPermissions`, `acceptEdits`, `dangerously` e `--tools default` em `src/`.

### Destino dos dados

Cada provedor processa o texto mascarado num lugar diferente: Anthropic (Claude Code), a própria máquina (Ollama/LM Studio) ou o provedor hospedado escolhido (por exemplo, o DeepSeek processa na China). Por isso o modal de preview mostra o **destino** antes do envio. Para logs com dados pessoais ou sensíveis, avaliar a LGPD e a política da sua organização antes de usar provedores hospedados.

## Alternativas consideradas

| Alternativa | Por que não (agora) |
|---|---|
| Só a API da Anthropic (plano original) | cobrada por token, à parte da assinatura; virou uma opção entre três |
| Endpoint "compatível com OpenAI" da Anthropic, via o provedor genérico | a orientação oficial da Anthropic é usar o SDK oficial, não shims de compatibilidade |
| `safeStorage` do Electron para as chaves | o Keychain direto deixa a chave visível e removível no app Acesso às Chaves e permite cadastrá-la pelo terminal sem passar pelo app |
| Codex CLI / Gemini CLI | viáveis; ficam no backlog do MVP 2 para não ampliar o escopo |

## Consequências

- Uso sem custo extra para quem tem assinatura do Claude ou roda um modelo local.
- O G2 passa a permitir processos externos também em `src/ai/providers/`, com argv fixo e validado.
- A qualidade da explicação depende do provedor: modelos locais pequenos explicam pior que o Claude.
- Se a equipe for usar o LogDeck, cada pessoa usa o próprio login no CLI; confirmar se os termos de cada plano permitem esse uso.

## Pendências

- Testes manuais com o `claude` real e com a API da Anthropic (texto fictício do fixture): **autorizados em 12/10/2026**, executados ao fim da fase 7.
- A chave colada no chat em 12/10/2026 deve ser revogada após os testes (ficou no histórico da conversa).
