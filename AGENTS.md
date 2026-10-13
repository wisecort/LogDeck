# AGENTS.md — regras para agentes de IA

Vale para qualquer IA que mexa neste repositório (Claude Code, Codex, Copilot e afins).

## Antes de cada tarefa

1. Leia [`SPEC.md`](SPEC.md) e [`GUARDRAILS.md`](GUARDRAILS.md).
2. Confirme a fase atual em [`CHANGELOG.md`](CHANGELOG.md) e trabalhe só nela.

## Como trabalhar

- **Teste vermelho primeiro**, depois a implementação. O commit da fase mostra o teste passando.
- Rode `make harness` antes de dizer que terminou e mostre o resumo ✅/❌ de cada etapa. Se algo falhar, diga o que falhou, com a saída. Não diga que terminou com etapa vermelha.
- **Uma fase = um commit**, em Conventional Commits: `feat(logs): ...`, `fix(shell): ...`, `test(parsers): ...`, `docs(runbook): ...`, `chore(ci): ...`.
- Commits **sem** o trailer `Co-Authored-By` (decisão do autor em 12/10/2026).
- Código, nomes de arquivos e commits em inglês. Documentação e respostas ao usuário em português.
  Exceção: o `README.md` e o `PRIVACY.md` são em inglês, com a versão em português em `README.pt-BR.md` e `PRIVACY.pt-BR.md`; mudou um, atualize o outro (capturas em `docs/images/en/` e `docs/images/`).
- Mudança fora do escopo do MVP 1 → anote em [`docs/backlog-mvp2.md`](docs/backlog-mvp2.md) e não implemente.
- Dependência nova → justifique (nome, motivo, licença) em `docs/dependencies.md` e no PR (G9).
- Na dúvida entre duas abordagens, **pergunte**. Não decida sozinho nada irreversível (renomear pacote, trocar stack, apagar histórico, mudar contrato de IPC).

## Proibido

- Acessar cluster real, `~/.kube/**`, `.env*` ou qualquer credencial.
- Rodar `kubectl`/`oc` com verbo de escrita, `config use-context` ou `config view --raw`.
- Commitar log real de cluster. Fixtures só anonimizadas (G8).
- Desativar ou contornar `scripts/guardrails.mjs`, hooks ou thresholds de cobertura para "fazer passar".
- Enviar conteúdo de log a qualquer serviço externo.

## Subagentes (`.claude/agents/`)

| Agente | Papel | Ferramentas |
|---|---|---|
| `parser-author` | escreve parsers e seus testes a partir das fixtures | Read, Write, Edit, Bash (só testes) |
| `security-reviewer` | revisa o diff contra `GUARDRAILS.md` antes do commit | Read, Grep (somente leitura) |
| `test-runner` | roda o harness e resume as falhas | Bash (só `make`) |

## Comandos

| Comando | O que faz |
|---|---|
| `make harness` | pipeline completo (igual ao CI) |
| `make test` | testes unitários e de integração |
| `make dev` | abre o app em modo desenvolvimento |
| `make harness-integration` | testes contra cluster `kind` local (manual, nunca no CI) |
