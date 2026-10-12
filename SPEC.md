# SPEC — LogDeck MVP 1

> Status: **aprovado** (fase 1) · Data: 12/10/2026 · Autor: Matheus Corteletti
> Leia junto com [`GUARDRAILS.md`](GUARDRAILS.md) e [`AGENTS.md`](AGENTS.md).

## 1. Visão

O **LogDeck** é um app desktop para macOS, Linux e Windows (desde a 1.1.0) que funciona como **log explorer de Kubernetes/OKD, somente leitura**. O usuário escolhe um contexto do kubeconfig, navega até namespace, pod e container, abre o log ao vivo e analisa por **nível** (cores e contadores) e por **texto** (ex.: `FPM`, `AH01075`, `timeout`). Um painel agrupa erros e timeouts por assinatura e, sob demanda, a IA explica os erros selecionados.

Projeto **greenfield**: o código-fonte do Logui não está disponível (é um app de terceiro, `com.marcosvidolin.logui`). O LogDeck é **inspirado no Logui**, que serviu de referência para os problemas reais P1–P5. Detalhes em [ADR 0001](docs/adr/0001-greenfield-electron-typescript.md).

### 1.1 Identidade

| Item | Valor |
|---|---|
| Nome do produto | LogDeck (janela, menu do app, Dock, `Info.plist` via electron-builder) |
| Bundle id | `io.github.wisecort.logdeck` |
| Binário | `LogDeck.app`; o comando `logdeck` no terminal fica para depois (link simbólico para o executável) |
| Repositório | [`wisecort/LogDeck`](https://github.com/wisecort/LogDeck) (público, CI no GitHub Actions) |

### 1.2 Stack

| Camada | Escolha |
|---|---|
| Runtime | Electron (versão estável mais recente na fase 2) |
| Linguagem | TypeScript `strict` |
| UI | React + Vite (electron-vite) |
| Pacotes | npm (`npm ci`, lockfile commitado) |
| Testes | Vitest (unit + integração, cobertura v8), Playwright `_electron` (E2E) |
| Lista virtualizada | `@tanstack/react-virtual` |
| Terminal (P5) | `node-pty` + `xterm.js` |
| IA | Claude Code CLI (`spawn`), API da Anthropic (`@anthropic-ai/sdk`) ou API compatível com OpenAI (`fetch`), sempre no processo main |
| Build | electron-builder; macOS assinado ad-hoc (sem conta Apple, sem notarização), demais sem assinatura: macOS `.dmg`/`.zip` (arm64 e x64), Linux AppImage/`.deb`/`.rpm` (x64), Windows instalador `.exe` (x64) |

Toda dependência é justificada no PR (G9).

## 2. Arquitetura

```
┌──────────────── processo main (Node) ────────────────┐
│ src/k8s/kubectl.ts  único spawn do kubectl (array)   │
│ src/k8s/args.ts     allowlist de verbos/flags/nomes  │
│ src/k8s/contexts.ts contextos sem credenciais        │
│ src/k8s/stream.ts   logs -f, reconexão, kill         │
│ src/k8s/shell.ts    exec -it via node-pty (manual)   │
│ src/ai/redact.ts, explain.ts, providers/ (CLI, HTTP) │
└───────────▲──────────────── IPC tipado (preload) ────┘
            │ lotes de linhas brutas a cada 100 ms
┌───────────┴──────── renderer (sandbox) ──────────────┐
│ src/ui/engine.ts: src/logs/* (parsers, classify,     │
│   buffer, signatures) na thread da UI, render ≤100ms │
│ Blob Worker descartável: só busca por regex (F5.4)   │
│ src/ui/*:   lista virtualizada, filtros, painel F6   │
└──────────────────────────────────────────────────────┘
```

- Renderer com `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` e CSP restritiva. O preload expõe só uma API estreita e tipada (`listContexts`, `listNamespaces`, `listPods`, `startStream`, `stopStream`, `openShell`, `explain`...). O renderer **nunca** monta argumentos do kubectl.
- Linhas de tempo (histograma, filtro de intervalo, grupos do F6) usam `timelineTime` = horário do kubectl ou, na falta, o do log.
- `src/logs/` é TypeScript puro, sem Electron nem DOM, testável em Node. Roda na thread da UI: cada lote (~200 linhas a 2.000 l/s) custa poucos ms e o filtro só é recalculado quando muda (busca em 50k ≤ 100 ms). A única operação que pode travar, a regex do usuário, roda num Blob Worker descartável. Decisão revisada na fase 6 (o rascunho previa todo o núcleo num Web Worker).
- Regex do usuário roda num worker descartável com orçamento de tempo (ver F5 / RNF4).

## 3. Funcionalidades (F1–F7)

Formato: **Dado / Quando / Então**. Cada critério vira pelo menos um teste (unitário, integração com kubectl fake ou E2E).

### F1 — Conexão ao cluster

- **F1.1** Dado um kubeconfig em `~/.kube/config` ou em `$KUBECONFIG` (lista separada por `:`), quando o app abre, então lista todos os contextos (nome, cluster, namespace padrão) e marca o contexto atual.
- **F1.2** Quando o usuário escolhe outro contexto, então todas as chamadas seguintes passam `--context=<nome>` e **nenhum** comando `config use-context` é executado (teste: o kubectl fake registra os argv recebidos e falha se aparecer `use-context`).
- **F1.3** A listagem usa só `kubectl config get-contexts` (saída tabular, sem credenciais). Dado um kubeconfig fake com `token`, `client-key-data` e `certificate-authority-data`, então nenhum desses valores aparece no retorno de `contexts.ts`, nos logs do app nem no IPC.
- **F1.4** Dado um contexto com `prod` ou `prd` no nome (sem diferenciar maiúsculas), então a UI mostra a marca vermelha PROD no seletor de contexto e na barra de status enquanto ele estiver ativo (G5). A faixa no topo saiu na 1.4.0, a pedido do autor.
- **F1.5** Na abertura, o app roda `kubectl version --client -o json` para detectar instalação e versão. Dado que o kubectl não está instalado, ou que o cluster responde erro de autenticação, então o app mostra mensagem acionável (ex.: `brew install kubectl`, "token expirado: rode `oc login` no terminal") sem travar.

### F2 — Navegação

- **F2.1** Dado um contexto, quando selecionado, então lista namespaces (`get namespaces -o json`). Se não houver permissão de listar namespaces (comum no OKD), então usa o namespace padrão do contexto e permite digitar um namespace, validado como DNS-1123 label.
- **F2.2** Dado um namespace, então lista pods (`get pods -o json`) com fase/status efetivo (Running, Pending, CrashLoopBackOff, ImagePullBackOff, Completed...), contagem de restarts e idade. Atualiza a cada 5 s enquanto a tela estiver visível.
- **F2.2.1** No OKD/OpenShift, cada namespace mostra primeiro os pods da aplicação e depois a pasta **Builds e deploys** (recolhida por padrão, estado salvo): os objetos `Build` (`kubectl get builds.build.openshift.io`, só leitura), do mais novo para o mais antigo, com status, commit, duração e idade; clicar abre o log do pod do build quando ele ainda existe (anotação `openshift.io/build.pod-name`), senão o item fica desabilitado com o aviso de que o cluster removeu o pod. Na mesma pasta ficam os pods de deploy (`openshift.io/deployer-pod-for.name`) e pods de build sem objeto `Build`. Em clusters sem a API de builds ou sem permissão, a lista de builds fica vazia, sem erro.
- **F2.3** Dado um pod com mais de um container (inclui init containers), quando selecionado, então o app pede a escolha do container antes de abrir o log. Pod com um container abre direto.
- **F2.4** Nomes recebidos do cluster são validados antes de reutilizados em argumentos: namespace e container como DNS-1123 label, pod como DNS-1123 subdomain. Nome inválido é descartado e registrado como aviso.

### F3 — Log ao vivo

- **F3.1** Quando o usuário abre um container, então o app executa `kubectl logs -f --timestamps --context=… -n … <pod> -c <container>` com `--tail` (padrão 1000) e opcional `--since` (ex.: `5m`, `1h`).
- **F3.1.1** Pods terminados (fase `Succeeded`/`Failed`, como builds concluídos e Jobs) são lidos uma vez, sem `-f` e sem reconexão; o status fica "Encerrado".
- **F3.2** Dado um pod em CrashLoopBackOff ou com restarts > 0, então a opção `--previous` fica disponível. Com ela marcada, o app roda sem `-f` e mostra o estado "Encerrado (log anterior)".
- **F3.3** Indicador de estado: **Live**, **Reconectando (n)**, **Pausado**, **Encerrado**, **Erro**. "Pausado" congela a visualização e continua acumulando no buffer.
- **F3.4** Dada uma queda do stream (kubectl sai sem ação do usuário), então reconecta com backoff 1 s, 2 s, 5 s, 10 s, 10 s… usando `--since-time=<último timestamp recebido>` e descarta linhas repetidas com timestamp ≤ ao último. Teste: o kubectl fake derruba a conexão e a sequência de esperas é verificada com relógio falso.
- **F3.5** Quando o usuário troca de pod, fecha a aba ou fecha o app, então o processo kubectl recebe SIGTERM (SIGKILL após 2 s). Teste: nenhum PID filho vivo depois de `stopStream`/`app.quit`.
- **F3.6** A saída é tratada como texto: sequências ANSI são removidas ou convertidas em estilo seguro, e nada é renderizado como HTML.

### F4 — Filtro por nível (cores)

- **F4.0** Logs de build do OKD (buildah/docker/s2i) têm parser próprio: `STEP n/m` e push em INFO (com campos `step` e `instruction`), camadas e cópia de blobs em DEBUG, `error: build error`/`ERRO:` em ERROR, `warning:` em WARN. Em pods de build, linhas sem formato (saída dos `RUN`) ficam INFO em vez de UNKNOWN.
- **F4.1** Níveis: TRACE, DEBUG, INFO, WARN, ERROR, FATAL, UNKNOWN, cada um com cor fixa e contador ao vivo.
- **F4.2** Quando o usuário clica num nível, então alterna a visibilidade dele. ⌥+clique mostra só aquele nível.
- **F4.3** Os contadores refletem as linhas presentes no buffer (descontadas as descartadas) e batem com a soma das linhas por nível (invariante testada em `buffer.test`).

### F5 — Busca por texto

- **F5.1** `⌘F` foca a busca. Modo padrão: texto simples, sem diferenciar maiúsculas. Alternância para regex e para diferenciar maiúsculas.
- **F5.2** Campo de **exclusão** separado (ex.: `checagem de disponibilidade`), aceitando vários termos.
- **F5.3** O termo encontrado é destacado na linha por fatiamento de texto (sem HTML). `⌘G` / `⇧⌘G` navegam entre ocorrências e a contagem é exibida.
- **F5.4** Dada uma regex catastrófica como `(a+)+$` sobre uma linha de 50 `a` seguidos de `!`, então a busca é interrompida em ≤ 250 ms, a UI continua responsiva e aparece o aviso "Regex muito custosa". Regex inválida mostra erro inline.

### F6 — Painel de erros e timeouts (sem IA)

- **F6.1** Linhas ERROR/FATAL e linhas de timeout (qualquer nível) são agrupadas por **assinatura**. Cada grupo mostra título, contagem, primeira e última ocorrência e uma linha de exemplo. Primeira/última usam o relógio do kubectl (`--timestamps`) quando existe, para que grupos de formatos com e sem fuso sejam comparáveis; sem ele, o horário do log.
- **F6.2** Catálogo inicial de assinaturas (regras escritas pela equipe, testadas):

| id | Título | Detecta |
|---|---|---|
| `apache-phpfpm-timeout` | Timeout Apache → PHP-FPM | `AH01075` e/ou `(70007)` com `proxy_fcgi` |
| `startup-permission` | Permissão no startup | `chown`/`chmod`/`mkdir` + `Operation not permitted`/`Permission denied` |
| `nginx-upstream-timeout` | Timeout upstream (Nginx) | `upstream timed out` |
| `node-etimedout` | Timeout de conexão | `ETIMEDOUT`, `ESOCKETTIMEDOUT` |
| `fpm-max-children` | PHP-FPM sem workers | `server reached pm.max_children` |
| `php-fatal` | PHP Fatal error | `PHP Fatal error` |
| `generic` | (mensagem normalizada) | demais ERROR/FATAL, agrupados após trocar números, hex, UUIDs, IPs e timestamps por marcadores |

- **F6.3** Dadas as linhas de P4 nas fixtures, então existem exatamente os grupos "Timeout Apache → PHP-FPM" e "Permissão no startup" com as contagens e datas esperadas.
- **F6.4** Clicar num grupo filtra a lista principal para as linhas dele. Cada grupo tem caixa de seleção para o F7.

### F7 — "Explicar esses erros" (IA)

Implementado só depois de F1–F6 verdes no harness. Nenhum teste automático chama IA de verdade.

- **F7.0 Provedores.** O usuário escolhe um nas Preferências; sem provedor configurado, o botão mostra "Configure um provedor de IA nas Preferências".

  | Provedor | Como é chamado | Custo / destino |
  |---|---|---|
  | **Claude Code CLI** (`claude`) | detectado com `claude --version`; executado com `spawn` (array, sem shell) como `claude -p --output-format json --tools "" --no-session-persistence --strict-mcp-config --disable-slash-commands --permission-mode dontAsk --system-prompt <fixo>`, com o payload pelo **stdin**, `cwd` numa pasta temporária vazia (apagada no fim) e timeout de 120 s | usa o login do usuário no Claude Code (plano Pro/Max sem cobrança por chamada; login por chave de API é cobrado por token) · Anthropic |
  | **API da Anthropic** | SDK oficial `@anthropic-ai/sdk` no processo main: `client.beta.messages.create` com `model` configurável (padrão `claude-opus-5-5`), `output_config.effort: "medium"`, `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) e tratamento de `stop_reason: "refusal"`; timeout de 120 s | cobrado por token, à parte da assinatura (ADR 0002) · Anthropic |
  | **API compatível com OpenAI** | `POST {base}/chat/completions` com `fetch` no processo main, sem SDK; timeout de 120 s. Atalhos: Ollama (`http://localhost:11434/v1`), LM Studio (`http://localhost:1234/v1`), DeepSeek, OpenRouter, Groq e "Personalizado" (URL base + modelo) | depende do provedor; Ollama/LM Studio rodam localmente e nada sai da máquina |

  - HTTPS é obrigatório, exceto para `localhost`/`127.0.0.1`.
  - Chaves de API ficam no **cofre do sistema**: no macOS, no **Keychain**, em itens próprios (`logdeck-anthropic-api`, `logdeck-openai-compatible-api`), lidos e gravados pelo `/usr/bin/security`; no Windows e no Linux, criptografadas com o `safeStorage` do Electron (DPAPI, libsecret ou KWallet) em `userData/secrets.json` (0600), e no Linux sem cofre de verdade (`basic_text`) a chave não é gravada. Tudo no processo main. A chave nunca chega ao renderer, que só sabe "chave configurada: sim/não". Ollama/LM Studio não usam chave.
  - "Testar provedor" envia um prompt fixo ("Responda apenas OK"), sem nenhum log.
  - Codex CLI e Gemini CLI ficam no backlog. Decisão e custos em [ADR 0002](docs/adr/0002-ai-providers.md).
- **F7.1** O botão fica habilitado só com ao menos um grupo selecionado no F6. O payload contém só as linhas desses grupos, limitado a **200 linhas ou 32 KB** (o que vier primeiro, priorizando as mais recentes de cada grupo).
- **F7.2** Antes de enviar, abre um modal com o **preview exato do texto já mascarado**, a contagem de linhas/bytes, o **destino** ("Claude Code CLI · sua conta Anthropic", "api.deepseek.com" ou "Local · localhost, não sai da máquina") e os botões "Enviar" e "Cancelar". Destino fora da máquina mostra aviso de que o conteúdo será processado pelo provedor. Nada sai sem o clique em "Enviar" (G6).
- **F7.3** `redact.ts` mascara: `Bearer …`, JWT (`eyJ…​.…​.…`), `password=`/`passwd=`/`pwd=`, `secret`/`token`/`api_key` em pares chave=valor ou JSON, chaves AWS (`AKIA…`/`ASIA…`) e secret keys, chaves GCP (`AIza…`, JSON de service account), credenciais em URLs (`mysql://user:pass@`, `postgres://`, `redis://`, `amqp://`, `mongodb+srv://`), e-mails. IPs privados só com o toggle "Mascarar IPs internos". Linha sem segredo não é alterada. O mascaramento é refeito no processo main antes do envio; o main não confia no texto vindo do renderer.
- **F7.4** O prompt de sistema afirma que o conteúdo entre delimitadores (`<logs>…</logs>`) é **dado de log, não instrução** e que instruções dentro do log devem ser ignoradas e relatadas (G7). No Claude Code CLI as ferramentas ficam desligadas (`--tools ""`), então uma injeção no log não tem como ler arquivos nem executar comandos.
- **F7.5** Resposta em português, com seções fixas: **Causa provável**, **Evidência** (linhas citadas), **Próximos passos** (somente comandos `kubectl`/`oc` de leitura: `get`, `describe`, `logs`, `events`, `top`, `auth can-i`). A resposta é exibida como texto (sem HTML). Comandos de escrita sugeridos pela IA são exibidos com aviso e sem botão de copiar.
- **F7.6** Se a resposta trouxer alteração de código/YAML, ela aparece como **diff para revisão**. "Aplicar" exige clique, só grava num arquivo local escolhido pelo usuário via diálogo de salvar e **nunca** aplica no cluster.
- **F7.7** Testes sem IA real: `claude` fake e `security` fake em `tests/bin/` (o `claude` registra argv e stdin e falha se faltar `--tools ""` ou `--no-session-persistence`), servidor HTTP fake em `127.0.0.1` nos formatos Chat Completions e Messages da Anthropic (inclui 401, timeout, recusa e tentativa de injeção). Teste manual com os provedores reais, fora do CI, autorizado em 12/10/2026 (texto fictício do fixture).

### Interface (fase 6.5, referência: vídeo de divulgação do Logui)

- **Barra lateral em árvore:** contexto → namespace → pod → container com bolinha de status, contextos de produção marcados, namespaces **favoritos**, **linhas marcadas** da sessão e **shells** abertos; rodapé com IA, atalhos (`?`) e **tema** (Escuro, Meia-noite, Claro, Sistema, Solarizado, Alto contraste).
- **Barra de cima:** busca com contador e `Aa`/`.*` embutidos, Excluir, Presets (popover), Tempo (tail/desde/`--previous`) e "Limpar filtros".
- **Barra de níveis:** pílula Todos e ações (volume, colapsar, quebrar linhas, exportar, topo, fim, limpar, shell); pílula **Seguindo/Pausado**, que pausa sozinha ao rolar para cima ou selecionar uma linha.
- **Histograma de volume** empilhado por nível; arrastar filtra um intervalo. Usa o relógio do kubectl, como o painel F6.
- **Linhas em uma linha só** (quebra opcional); selecionar abre a aba **Detalhes** (horários, campos, JSON, stack trace, Copiar, Marcar, Perguntar à IA).
- **Painel direito com abas** Erros / Detalhes / IA. A IA aceita **pergunta livre** e **perguntas de acompanhamento**, com contexto = linha selecionada (±10 linhas), grupos marcados ou linhas visíveis no filtro; o preview com destino continua obrigatório. A "Estimativa da IA" (confiança) é exibida com aviso de que pode estar errada.
- **Barra de status:** estado, contexto › namespace › pod › container, linhas exibidas/total, descartadas e provedor de IA.
- **Seletor de contexto** no topo da barra lateral: um contexto ativo por vez (começa no contexto atual do kubeconfig, lembra o último escolhido) e a árvore mostra os namespaces dele. Nomes no estilo `oc login` (`projeto/api-host:6443/usuário`) aparecem como `projeto (host)`; ARNs do EKS como `cluster (EKS · região)`, sem o número da conta; GKE como `cluster (GKE · zona)`. Em "Gerenciar contextos…" o usuário pode **renomear** o contexto só no LogDeck (apelido em localStorage, até 60 caracteres); o apelido aparece no seletor, na barra de status, na faixa de produção e no "Copiar para chamado". A opção "Gerenciar contextos…" **oculta** contextos só no LogDeck e oferece o comando `kubectl config delete-context` para o usuário rodar no próprio terminal: o app nunca edita o kubeconfig (G1/G4).
- **Procurar pod ou namespace:** campo acima da árvore; filtra pelos nomes dos namespaces e dos pods já carregados, abrindo os namespaces com pods encontrados.
- **Copiar para chamado** (aba Detalhes): pod (namespace / pod / container) ou arquivo, contexto, horários em UTC (kubectl e log), nível e a linha com stack trace, com senhas e tokens mascarados pelas regras do `redact.ts` (IPs mantidos). A cópia passa pelo processo main (`clipboard:copy-text`).
- **Abrir arquivo de log** (⌘O, botão na barra lateral ou arrastar para a janela): lê no renderer um arquivo escolhido pelo usuário (texto, até 200 MB; recusa vazio e binário/compactado), com ou sem o prefixo de `--timestamps`, e passa pelos mesmos parsers, filtros, painel F6 e IA. Nenhuma chamada ao cluster. Acima de 50k linhas valem as regras do buffer (descarta as mais antigas).
- **Preferências** (rodapé da barra lateral): tema (9 opções: Escuro, Meia-noite, Claro, Sistema, Alto contraste, Dracula, Nord, Tokyo Night e Catppuccin Mocha), **idioma da interface** (Português do Brasil, Português de Portugal, English, Español; padrão = idioma do sistema, português cai em pt-BR, outros em inglês) e **Sobre** (versão, licença MIT, link do repositório, "Feito por Matheus Corteletti — Wise" e botões GitHub e LinkedIn; o main só abre esses dois endereços fixos, `app:open-link` com id). O menu nativo do macOS segue o idioma e tem só o necessário: LogDeck (Sobre, Ocultar, Encerrar), Editar (desfazer, refazer, recortar, copiar, colar, selecionar tudo) e Janela (minimizar, fechar); sem menu Visualizar e sem os itens de Ditado e Emojis que o macOS injeta. O idioma vale também para as mensagens do kubectl (traduzidas no processo main), os títulos das regras do catálogo F6 (grupos genéricos mostram a mensagem do log) e as respostas da IA (o prompt de sistema pede o idioma e os títulos de seção correspondentes). Mensagens internas raras de validação continuam em português.
- **Barra de ações:** "Terminal" com ícone e texto (abre o shell do container, ação manual); pílula **Ao vivo / Pausado** (antes "Seguindo") e botão de pausar/retomar (ícone); exportar com ícone de download; os botões "Ir para o fim" e "Ir para o topo" saíram. A barra de status mostra "Conectado".
- **Abas:** cada aba tem seu motor de log, seu stream (ou arquivo), seleção e opções; as linhas chegam à aba dona do stream mesmo em segundo plano e só a aba ativa redesenha. "+" cria uma aba vazia; ⌘/Ctrl+clique ou clique do meio num pod abre numa aba nova; limite de 8 (cada aba pode ter um kubectl rodando). Trocar de aba reinicia a seleção de linha, marcadas e pausa.
- **Comparar com o anterior:** em pods com container anterior, o botão de colunas abre um segundo stream com `--previous` (companheiro da aba) e divide a lista em Atual | Anterior; filtros de nível e texto valem para os dois; o anterior é só leitura (sem marcar/detalhes). Para ao desligar, ao trocar o pod ou ao fechar a aba.
- **Ícone:** SVG em `build/icon-src/` (padrão: Deck) convertido por `make icon` em `build/icon.icns`, que o electron-builder coloca no bundle.
- Não adotados: aplicar mudança direto no código, IA lendo o repositório, merge de fontes e alertas (backlog).

## 4. Problemas reais (casos de teste)

Fixtures anonimizadas em `tests/fixtures/` (G8: IPs `10.0.0.x`, hosts `*.example.internal`, sem nomes de empresas ou instituições reais).

### P1 — UNKNOWN acima de 999

Parsers plugáveis, um arquivo por formato em `src/logs/parsers/`, todos com a interface `{ id, detect(line), parse(line) → { level?, timestamp?, message, fields? } }`, tentados nesta ordem:

| # | Parser | Detecção | Nível |
|---|---|---|---|
| 1 | `json` | começa com `{` e é JSON válido | `level`/`level_name`/`severity`/`lvl`; numérico pino (10…60) e zap |
| 2 | `laravel` | `[YYYY-MM-DD HH:MM:SS] env.LEVEL:` | sufixo (`DEBUG`, `INFO`, `NOTICE`→INFO, `WARNING`→WARN, `ERROR`, `CRITICAL`/`ALERT`/`EMERGENCY`→FATAL) |
| 3 | `access` (Apache/Nginx combined/common) | `"METHOD path HTTP/x" status` | 5xx ERROR, 4xx WARN, 1xx–3xx INFO |
| 4 | `apache-error` | `[módulo:nível]` (2.4) ou `[nível]` (2.2) | `trace*`→TRACE, `debug`→DEBUG, `info`/`notice`→INFO, `warn`→WARN, `error`→ERROR, `crit`/`alert`/`emerg`→FATAL |
| 5 | `php-fpm` | `[DD-Mon-YYYY HH:MM:SS] LEVEL:` | `DEBUG`, `NOTICE`→INFO, `WARNING`→WARN, `ERROR`, `ALERT`→FATAL |
| 6 | `nginx-error` | `YYYY/MM/DD HH:MM:SS [nível] pid#tid:` | mesma tabela do Apache |
| 7 | `heuristic` | último recurso | 1º token de nível em maiúsculas (`TRACE`, `DEBUG`, `INFO`, `WARN`/`WARNING`, `ERROR`, `FATAL`); senão palavras inteiras: `fatal`/`panic`→FATAL, `error`/`exception`/`failed`/`permission denied`/`not permitted`→ERROR, `warn`/`timeout`/`timed out`/`deprecated`→WARN |

- **Multiline:** depois de remover o prefixo `--timestamps`, linhas que começam com espaço/tab, `#\d+ `, `at `, `Caused by:`, `Stack trace:`, `Next `, `... N more`, `[stacktrace]` ou `"}` (fim do contexto do Laravel), e linhas que são só o nome de uma exceção Java (`java.lang.IllegalStateException: …`), são anexadas à entrada anterior e herdam o nível dela.
- **Meta:** UNKNOWN **< 5%** das entradas de `tests/fixtures/*.log` (asserção em `classify.test`).

### P2 — todas as linhas com o horário de ingestão

Cada entrada guarda `k8sTime` (prefixo RFC3339Nano do `--timestamps`), `logTime` (extraído pelo parser, se houver) e `ingestTime`. A coluna de horário mostra `logTime ?? k8sTime` em horário local com milissegundos. Se `|logTime − k8sTime| > 2 s` (após normalizar fuso), um ícone mostra os dois valores no tooltip. `ingestTime` nunca é exibido como horário do log.

### P3 — ruído de health check

- **Presets de exclusão** salvos por `contexto + namespace` num JSON em `app.getPath('userData')` (sem nova dependência). Preset embutido "Ocultar health checks": `checagem de disponibilidade`, `kube-probe/`, `GET /healthz`, `GET /readyz`, `GET /livez`, `GET /ping`.
- **Colapsar repetidas:** linhas consecutivas com a mesma mensagem normalizada (sem timestamps) viram uma linha com selo `×N` e intervalo de horário. Liga/desliga, ligado por padrão.

### P4 — erros que o F6 deve destacar

Ver F6.3. Linhas-base:

```
chown: changing ownership of '/var/log/php-fpm/error.log': Operation not permitted
[proxy_fcgi:error] [pid 12:tid 140] (70007)The timeout specified has expired: [client 10.0.0.2:48660] AH01075: Error dispatching request to : (polling)
```

### P5 — Pod Shell sem TTY

- O shell abre com `kubectl exec -it --context=… -n … <pod> -c <container> -- sh -c 'command -v bash >/dev/null && exec bash || exec sh'` dentro de um **PTY** (`node-pty`) e renderiza em `xterm.js`.
- O resize da janela/painel é repassado ao PTY (`pty.resize(cols, rows)`) e o kubectl encaminha ao container.
- Critério: dado o kubectl fake em modo shell, então ele recebe `-it` e um stdin TTY (`isatty(0)` verdadeiro), e a saída não contém `cannot set terminal process group` nem `no job control`.
- O shell é aberto **apenas** por clique do usuário em "Abrir shell", com confirmação extra em contexto de produção. A IA nunca abre, lê ou digita no shell. Fechar a aba encerra o PTY e o kubectl.

## 5. Requisitos não funcionais

| # | Requisito | Como é verificado |
|---|---|---|
| RNF1 | Sustentar **2.000 linhas/s** sem travar a UI (frame > 50 ms raro) | teste de integração com kubectl fake em 2.000 l/s por 30 s; E2E mede long tasks |
| RNF2 | Ring buffer padrão **50.000 entradas**, configurável (10k–500k) | `buffer.test` |
| RNF3 | Memória total do app **< 500 MB** com 50k linhas | E2E lê `app.getAppMetrics()` |
| RNF4 | Busca sobre 50k linhas em ≤ 100 ms (texto) e regex abortada em ≤ 250 ms | `search.test` |
| RNF5 | UI atualizada em lotes a cada **100 ms** | teste do batcher com relógio falso |
| RNF6 | Backpressure: buffer cheio descarta as mais antigas e mostra "N linhas descartadas"; nunca congela | `buffer.test` + integração |
| RNF7 | Nenhum processo kubectl órfão | integração (F3.5) |
| RNF8 | Cobertura ≥ **90%** em `src/logs/`, `src/k8s/args.ts`, `src/ai/redact.ts` | thresholds no Vitest |
| RNF9 | macOS 13+ (arm64 e x64), Linux x64 (glibc, com GNOME Keyring/KWallet para guardar chaves de IA), Windows 10+ x64 | CI em `macos-latest`, `ubuntu-latest` e `windows-latest`, com integração e E2E nos três (no Windows os fakes de `tests/bin` viram `.exe` via Node SEA, `scripts/build-test-bins.mjs`) |

## 6. Testes

| Arquivo | Cobre |
|---|---|
| `parsers.<formato>.test.ts` | cada parser de P1: linhas válidas, truncadas, multiline |
| `classify.test.ts` | nível final, `logTime` × `k8sTime` (P2), meta UNKNOWN < 5% |
| `args.test.ts` | aceita `get`/`logs`; rejeita `delete`, `apply`, `use-context`, `--raw`, nomes com `;`, `$()`, espaço, `../`, `-` inicial |
| `contexts.test.ts` | kubeconfig fake sem vazar `token`/`client-key-data`/`certificate-authority-data` |
| `buffer.test.ts` | limite, descarte, contadores consistentes |
| `search.test.ts` | texto, regex, exclusão, `(a+)+$` com timeout |
| `signatures.test.ts` | grupos de P4, contagem, primeira/última ocorrência |
| `redact.test.ts` | cada padrão de F7.3 e linha limpa intacta |
| `guardrails.test.ts` | fixture "suja" falha, "limpa" passa |
| `tests/integration/*` | `tests/bin/kubectl` fake no `PATH`: contextos, ns, pods, `logs -f` com atraso, erro de auth, queda/reconexão, modo shell |
| `tests/e2e/*` | contexto → namespace → pod → log ao vivo → filtrar ERROR → buscar `FPM` → F6 mostra "Timeout Apache → PHP-FPM" |

Integração com cluster real (`kind`) é **manual**, via `make harness-integration`, e nunca roda no CI.

## 7. Fora de escopo (MVP 2 → [`docs/backlog-mvp2.md`](docs/backlog-mvp2.md))

- Publicação na internet, modo web, multiusuário
- Qualquer escrita no cluster (scale, delete, rollout, edit, apply, patch...)
- Assinatura/notarização Apple e auto-update
- Logs agregados de vários pods/deployment ao mesmo tempo

## 8. Fases

| # | Fase | Entrega |
|---|---|---|
| 1 | Governança | identidade, SPEC, AGENTS, CLAUDE, GUARDRAILS, ADR 0001 ← **aqui** |
| 2 | Proteções | `.claude/settings.json`, `guardrails.mjs`, `harness.sh`, Makefile, CI, pre-commit, scaffold Electron |
| 3 | Fixtures e testes vermelhos | fixtures P1–P4, kubectl fake, todos os testes unitários |
| 4 | Núcleo de logs | parsers, classify, buffer, search, signatures verdes |
| 5 | K8s | args, contexts, kubectl, F1–F3 com reconexão |
| 6 | UI | F4, F5, P3, F6, P5, E2E |
| 7 | IA | redact + F7 |
| 8 | Docs | README, runbook, ADRs, CHANGELOG, backlog |

## 9. Decisões

| # | Tema | Situação |
|---|---|---|
| 1 | Bundle id | aprovado: `io.github.wisecort.logdeck` |
| 2 | `kubectl version --client` no G1 | aprovado em 12/10/2026 |
| 3 | Repositório e CI | aprovado: GitHub `wisecort/LogDeck`, GitHub Actions em macOS, Linux e Windows; release automática ao criar tag `v*` |
| 4 | Licença | aprovado: MIT |
