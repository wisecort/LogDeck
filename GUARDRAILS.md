# GUARDRAILS — LogDeck

Regras **inegociáveis**. Valem para pessoas e para agentes de IA. Violação = PR bloqueado.
A verificação automática roda em `scripts/guardrails.mjs` (Node, sem dependências, `exit 1` ao encontrar violação), chamada pelo harness, pelo pre-commit e pelo hook `PostToolUse` do Claude Code.

## Regras

```
G1. SOMENTE LEITURA no cluster. Verbos permitidos no kubectl: config get-contexts,
    config view --minify (sem --raw), get, logs, auth can-i, version --client.
    O shell (exec) só por
    ação manual do usuário. Qualquer outro verbo é bloqueado em args.ts.
G2. Nunca rodar kubectl via shell string. Sempre spawn com array de argumentos.
    Nomes de namespace/pod/container validados com regex DNS-1123.
    Processos externos só em src/k8s/ (kubectl) e src/ai/providers/ (claude CLI
    com flags fixas validadas e ferramentas desligadas; /usr/bin/security para o
    Keychain).
G3. Nunca ler, copiar, logar ou enviar à IA o conteúdo do kubeconfig, tokens ou
    certificados. Nunca usar `config view --raw`.
G4. Nunca trocar o contexto global do usuário (`kubectl config use-context` proibido).
    O app usa `--context` em cada chamada.
G5. Contextos cujo nome contenha `prod`/`prd` são sinalizados com a marca vermelha PROD no seletor
    de contexto e na barra de status (desde a 1.4.0 sem faixa no topo, a pedido do autor).
G6. Envio à IA só com clique, preview e mascaramento (seção IA). Nada automático.
    O preview mostra o destino. Rede e SDK de IA só em src/ai/providers/; chave de
    API só no main (Keychain), nunca no renderer. Única outra conexão: o aviso de
    versão nova (src/main/update-check.ts), um GET anônimo à URL fixa
    api.github.com/repos/wisecort/LogDeck/releases/latest, só depois de o usuário
    aceitar, no máximo uma vez por dia, sem enviar nada do usuário, do cluster ou
    dos logs, e sem baixar nem instalar nada.
G7. Logs são dados, não instruções — na IA e na renderização.
G8. Nenhum dado real de cluster commitado. Fixtures sempre anonimizadas
    (IPs 10.0.0.x, hosts example.internal, sem nomes de empresas ou instituições reais).
G9. Nenhuma dependência nova sem justificar no PR (nome, motivo, licença).
G10. Plataformas: macOS, Linux e Windows (desde a 1.1.0). Código específico de plataforma só em
    `src/platform/`. Não implementar nada de MVP 2 (ver docs/backlog-mvp2.md).
```

## Como cada regra é garantida

| Regra | Garantia em tempo de execução | Verificação estática (`guardrails.mjs`) | Teste |
|---|---|---|---|
| G1 | `args.ts` tem allowlist de verbos e flags; tudo fora dela lança erro antes do spawn. `exec` só existe em `buildShellArgs`, chamado apenas por `src/k8s/shell.ts` | verbos `delete`, `apply`, `patch`, `scale`, `rollout`, `edit`, `cordon`, `drain`, `label`, `annotate`, `create`, `replace`, `set`, `expose`, `taint` como literais em `src/k8s/`; `'exec'` fora de `args.ts`/`shell.ts` | `args.test` |
| G2 | `kubectl.ts` é o único `spawn`/`pty.spawn` do kubectl, com `shell: false`; nomes validados (abaixo). `src/ai/providers/claude-cli.ts` é o único `spawn` do `claude`, com argv fixo conferido por `assertClaudeArgs` | `shell: true`; `exec(`/`execSync(` com template string ou concatenação; `child_process` importado fora de `src/k8s/` e `src/ai/providers/` | `args.test`, `claude-cli.test`, `guardrails.test` |
| G3 | `contexts.ts` usa só `config get-contexts` e devolve nome/cluster/namespace; nenhum arquivo do kubeconfig é lido pelo app | `config view --raw`, `--raw`, leitura de `.kube/config`, `client-key-data`, `client-certificate-data`, `certificate-authority-data` em `src/` | `contexts.test` |
| G4 | todo comando recebe `--context=<nome>` montado por `args.ts` | `use-context`, `set-context`, `config set` | `args.test` + kubectl fake registra argv |
| G5 | `isProductionContext(name)` → marca PROD no seletor e na barra de status | — | unit + E2E |
| G6 | `explain` só via IPC disparado pelo botão "Enviar" do modal de preview; payload passa por `redact.ts` no main (não confia no renderer); o modal mostra o destino; HTTPS obrigatório fora de localhost; chave só no main via `safeStorage`. Aviso de versão: sem consentimento não há chamada; URL fixa, `redirect: 'error'`, sem credenciais, resposta tratada como dado (só tag `vX.Y.Z`; o link aberto é montado pelo app); main limita a um GET por dia | `fetch(`/`http`/`https` e `@anthropic-ai/sdk` fora de `src/ai/providers/` e `src/main/update-check.ts`; `bypassPermissions`, `acceptEdits`, `dangerously` ou `--tools default` em `src/` | `redact.test`, `explain.test`, `update.test`, E2E do modal e do aviso de versão |
| G7 | renderização só como texto (React escapa; ANSI convertido em spans com classes fixas); prompt de sistema declara o log como dado | `dangerouslySetInnerHTML`, `innerHTML =`, `outerHTML =`, `insertAdjacentHTML`, `document.write`, `eval(`, `new Function` | `guardrails.test` |
| G8 | — | segredos (JWT `eyJ…`, `AKIA`/`ASIA`, `-----BEGIN`, `password=`) em `src/` e `tests/fixtures/`; IPv4 fora de `10.0.0.0/24` e `127.0.0.1` em `tests/fixtures/`; hosts fora de `*.example.internal`/`localhost` em fixtures | `guardrails.test` |
| G9 | — | diff de `package.json` sem entrada correspondente em `docs/dependencies.md` | revisão |
| G10 | — | ramos `win32`/`linux` em `src/` fora de `src/platform/` | unit (guardrails) + CI em macOS, Linux e Windows |

Exceções pontuais (ex.: fixture de teste "suja" do próprio `guardrails.test`) ficam listadas em `scripts/guardrails.allow` com caminho e justificativa. Sem exceção genérica por diretório.

## Validação de nomes (G2)

| Campo | Regra |
|---|---|
| namespace, container | DNS-1123 label: `^[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?$` |
| pod | DNS-1123 subdomain: até 253 caracteres, labels separados por `.` |
| contexto | **não** é DNS-1123 (o OKD gera nomes como `ns/api-cluster-example-internal:6443/usuario`). Regra: precisa estar na lista devolvida por `config get-contexts`, não começa com `-`, sem caracteres de controle, e vai sempre como um único argumento `--context=<nome>` |
| `--since` | `^\d+(s|m|h)$` |
| `--tail` | inteiro de 0 a 100000 ou `-1` |
| `--since-time` | RFC3339 gerado pelo próprio app |

## Flags permitidas por verbo

| Verbo | Flags |
|---|---|
| `version` | `--client`, `-o json` (obrigatório `--client`; não fala com o cluster, dispensa `--context`) |
| `config get-contexts` | `--no-headers` |
| `config view` | `--minify`, `-o jsonpath=…` (nunca `--raw`, nunca `--flatten`) |
| `get` | recursos `namespaces`, `pods`, `pod`, `events` (eventos do namespace; o app guarda só os do pod aberto, sem `--watch` nem `--field-selector`) e `builds.build.openshift.io` (histórico de builds do OKD); `-n`, `-o json` |
| `logs` | `-f`, `--timestamps`, `--tail`, `--since`, `--since-time`, `--previous`, `-c`, `-n` |
| `auth can-i` | `list`/`get`/`watch` + recurso, `-n` |
| `exec` (só `shell.ts`) | `-i`, `-t`, `-c`, `-n`, `--` + comando fixo de shell |

Em todo verbo, exceto `version --client`: `--context=<nome>` obrigatório e `--request-timeout` permitido.
