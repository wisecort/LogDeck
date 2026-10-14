# Changelog

[English](CHANGELOG.md) · **Português**

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Uma entrada por fase.

## [Não lançado]

- **Marcas entre as linhas do log**, para um trecho vazio nunca ficar ambíguo: "Conexão perdida às … de volta às …" quando o stream do kubectl caiu (as linhas desse intervalo são buscadas de novo, sem duplicar), "Sem logs por 2m 10s" quando o stream estava conectado e o container não escreveu nada (mais de um minuto e 20× o intervalo normal entre linhas, para jobs lentos não serem marcados), "Container … reiniciado" com o motivo, o exit code e quanto tempo rodou, com o botão **Ver logs anteriores**, e "N linhas antigas descartadas" acima da linha mais antiga quando o buffer de 50.000 linhas enche. O histograma mostra os restarts como traços vermelhos e as quedas do stream como faixas hachuradas. As marcas somem durante a busca e no filtro por grupo de erro (pedido no r/kubernetes).
- **Aba Pod** no painel da direita: estado e tempo no ar do container, restarts, a execução anterior (motivo como OOMKilled, exit code, quanto tempo rodou e quando terminou), imagem, requests e limits de memória e CPU, probes de readiness/liveness/startup (probe de comando mostra só "comando", nunca o comando), nó, criação e QoS. As execuções vistas enquanto o app está aberto também aparecem (o Kubernetes guarda só a última). A barra de status mostra o tempo no ar e os restarts do container. Vem do mesmo `kubectl get pods -o json` que a barra lateral já atualiza.
- Arquivos de comunidade para quem quer contribuir: `CONTRIBUTING.md` (como rodar, regras, assistência de IA), `SECURITY.md` (relato privado de vulnerabilidades), `CODE_OF_CONDUCT.md`, modelos de issue (bug, sugestão) e de pull request.
- Site no GitHub Pages (https://wisecort.github.io/LogDeck/), em inglês e português: vídeo de demonstração, capturas, as garantias de somente leitura e os downloads por sistema (o do visitante aparece primeiro), com os comandos para instalar o kubectl, um antes e depois, zoom nos detalhes, os recursos extras e perguntas frequentes; capturas Retina do `make site-shots`. Gerado de `site/` pelo `scripts/build-site.mjs` e publicado pelo `.github/workflows/pages.yml` depois de cada release.
- O LogDeck está na [Microsoft Store](https://apps.microsoft.com/detail/9P5LTZ7FBWC4) (publicado com a 1.6.0): assinado pela Microsoft, sem aviso do SmartScreen, atualizado pela Store. Os dois READMEs mostram o selo da Store e a recomendam no Windows.

## [1.6.1] — 13/10/2026

- Correção: no Linux, o `.deb`/`.rpm` mostrava uma engrenagem genérica no lugar do ícone do LogDeck (GNOME e outros ambientes). O pacote agora leva o ícone nos tamanhos padrão (16 a 512 px, `build/icons/`, gerados pelo `make icon`), e a descrição do atalho está em inglês e não diz mais só "macOS".
- O **Copiar com detalhes** segue o "Mascarar dados sensíveis": esconde também o nome do contexto (endereço do cluster e usuário) e os IPs internos. Correção: o "Copiado" agora volta depois de 2 s em vez de ficar preso.

## [1.6.0] — 13/10/2026

- **Pacote da Microsoft Store (appx/MSIX):** `npm run release:store` gera o pacote (`build.appx` com a identidade do Partner Center, logos da Store em `build/appx/` feitos por `scripts/build-appx-assets.sh`, que o `make icon` também roda). O CI gera o pacote em todo PR e em cada release como artefato do workflow (nunca como arquivo da release: a Store assina na publicação). Passos de teste e envio em `docs/microsoft-store.md`.
- A cópia da Microsoft Store nunca consulta o GitHub atrás de versão nova: a Store atualiza o app (`src/platform/distribution.ts`).
- **Sem kubectl? A tela inicial diz como instalar:** um cartão destacado com o comando de instalação do sistema (winget, brew, snap), botão **Copiar** e **Verificar de novo**, que acha o kubectl sem reiniciar o app; enquanto isso, já dá para abrir arquivos de log. O README também diz como instalar o `oc`.
- **O Início é a casinha:** o app abre na tela inicial com a casinha acesa e sem nenhuma aba; abas são só para pods, arquivos e builds. A casinha mostra a tela inicial e deixa as abas abertas rodando (antes ela esvaziava a aba atual e parava o log). O botão "+" saiu: ⌘/Ctrl+clique ou clique do meio num pod abre em aba nova.
- **Copiar com máscara:** os Detalhes têm a opção "Mascarar dados sensíveis" para o **Copiar**: esconde senhas, tokens, chaves, e-mails e IPs internos (10.x, 172.16–31.x, 192.168.x) na linha e no stack trace copiados. Desligada por padrão e lembrada nesta máquina; o log na tela não muda.
- "Copiar para chamado" agora se chama **Copiar com detalhes** (pod, horários em UTC, nível e a linha, com segredos mascarados).
- **Preferências mais largas:** duas colunas quando há espaço (temas à esquerda; idioma, atualizações e Sobre à direita), e tudo aparece sem rolar na janela padrão; uma coluna em janela estreita.
- Correção: um plugin de login ausente (`oc`, `aws`, `gke-gcloud-auth-plugin`, `kubelogin`…) aparecia como "Recurso não encontrado (o pod pode ter sido removido)". Agora a mensagem diz qual plugin falta e pede para instalar ou conferir o PATH.
- **CHANGELOG em inglês** (`CHANGELOG.md`), com a versão em português em `CHANGELOG.pt-BR.md`.
- **Notas da release com as mudanças:** cada release do GitHub mostra a seção da sua versão no `CHANGELOG.md` (`scripts/release-notes.mjs`) em vez de "veja o CHANGELOG", mais o link da política de assinatura; a release falha se a versão não tiver seção.
- README: situação da assinatura de código atualizada. A SignPath Foundation recusou o primeiro pedido (projeto novo demais); as versões seguem sem assinatura, e vamos pedir de novo quando o projeto tiver mais uso.
- Teste de integração do shell estável no Windows: também redigita o `exit` quando o ConPTY perde as primeiras teclas.
- Capturas do README refeitas pelo `make screenshots` (`tests/screenshots`, kubectl falso e logs fictícios, em inglês e português).

## [1.5.0] — 12/10/2026

- **README em inglês** (`README.md`, com capturas da interface em inglês em `docs/images/en/`) e versão em português em `README.pt-BR.md`, com links entre elas.
- **winget:** manifestos do pacote `wisecort.LogDeck` 1.4.0 em `packaging/winget/` (instalador por usuário, depende de `Kubernetes.kubectl`), prontos para o PR no `microsoft/winget-pkgs`.
- **Política de assinatura de código** (seção nos READMEs) e **política de privacidade** (`PRIVACY.md` / `PRIVACY.pt-BR.md`), exigidas para o pedido de assinatura grátis na SignPath Foundation; as notas de cada release trazem o link "Code signing policy".
- **Aviso de versão nova** (só com consentimento): a tela inicial pergunta uma vez se pode avisar; se sim, o main faz no máximo um GET anônimo por dia a `api.github.com/repos/wisecort/LogDeck/releases/latest` (URL fixa, sem credenciais, sem redirecionamento, resposta tratada como dado). Quando há versão nova, a barra de status mostra "X.Y.Z disponível", e o modal traz os comandos do Homebrew e do winget e o link da release, com "Pular esta versão". O LogDeck nunca baixa nem instala nada. Liga/desliga em Preferências → Atualizações. G6, política de privacidade e READMEs atualizados.
- **winget automático:** o workflow de release abre o PR "Update: wisecort.LogDeck to X.Y.Z" no `microsoft/winget-pkgs` (`scripts/update-winget.sh`, manifestos gerados por `scripts/winget-manifests.mjs` a partir da versão anterior), sem actions de terceiros; precisa do secret `WINGET_TOKEN`. Localmente: `make winget VERSION=X.Y.Z`.
- Teste de integração do shell estável no Windows: redigita o comando quando o ConPTY perde as primeiras teclas.

## [1.4.0] — 12/10/2026

- **README novo** com tour visual: boas-vindas, detalhes, erros, builds do OKD, comparação com o anterior, tema claro, Preferências e Atalhos (capturas feitas com dados fictícios).
- **Recentes:** um × ao passar o mouse tira o pod da lista (fica salvo).
- **Visual Cockpit:** tela de boas-vindas nas abas vazias (logo, cartões Pods / Arquivo / Último pod com atalhos, status do contexto e do kubectl), botão **Início** na barra de abas, indicador ao vivo pulsando, superfícies de vidro e brilho na cor de destaque.
- **Preferências** redesenhadas: temas em miniaturas com as cores reais, idiomas em botões, cartão Sobre com logo. **Atalhos** agrupados (Geral, Busca, Mouse) com teclas desenhadas (Ctrl no Windows/Linux).
- **Builds do OKD** numa pasta dentro do namespace, depois dos pods: o histórico de builds (`kubectl get builds.build.openshift.io`, só leitura) com status, commit, duração e idade; abre o log do container principal do build quando o pod ainda existe; quando o cluster já removeu o pod, abre um painel com os detalhes do build (status, motivo, commit, duração) e o comando `oc describe` para copiar. Pods de deploy na mesma pasta.
- **Produção (G5):** sem a faixa vermelha no topo; a marca PROD fica no seletor de contexto e na barra de status.
- **Logs de build do OKD reconhecidos:** parser para buildah/docker/s2i (`STEP n/m`, camadas `-->`, `Copying blob`, `COMMIT`, push, `git clone`, `error: build error`, `ERRO:`), com passo e instrução em campos; a saída dos `RUN` vira INFO em vez de UNKNOWN; regra "Falha no build" no painel de erros. Abrir um build mostra só o container do build (sem as etapas de init).
- **Pods já terminados** (builds concluídos, Jobs) são lidos uma vez, sem `-f`: antes o app ficava reconectando a cada 1–10 s.
- **Refinamento visual:** escala de espaçamento, raios, sombras e tipografia em variáveis CSS; barras de rolagem finas; foco de teclado visível e animações que respeitam `prefers-reduced-motion`.
  - Linhas de log mais fáceis de escanear: INFO/DEBUG discretos, WARN/ERROR/FATAL com etiqueta preenchida, marcador à esquerda e fundo levemente tingido; milissegundos esmaecidos; seleção com borda de destaque.
  - Barra de níveis numa linha só (filtros de nível segmentados, grupos de ícones com separadores, Terminal); **Ao vivo / Pausado** e pausar juntos no fim da barra de cima. Presets e Tempo como botões com contador e seta.
  - Barra lateral com guias de indentação na árvore, contadores nas pastas, estrela de favorito só ao passar o mouse; o pod fica discreto quando um container dele está selecionado.
  - Painel direito: abas segmentadas, grupos de erro em cartões, cabeçalho da linha selecionada com ações, campos em tabela, estados vazios com ícone; botão principal desabilitado neutro.
  - Abas com linha de destaque na aba ativa; barra de status com ponto de estado pulsando e caminho com separadores; janela estreita (≤1280 px) dá mais espaço ao log.
- Tempo esgotado do kubectl com mensagem útil e traduzida (qual comando demorou e o que verificar: VPN/rede, login do contexto).

## [1.3.0] — 12/10/2026

- **Pods de build e de deploy do OKD ocultos:** pods criados por BuildConfig (`openshift.io/build.name`) e por DeploymentConfig (`openshift.io/deployer-pod-for.name`) ficam escondidos na árvore; "+ N builds/deploys do OKD" mostra todos, com a marca `build`/`deploy`, e a escolha é lembrada.

## [1.2.1] — 12/10/2026

- Correção: o app do macOS baixado da internet aparecia como "danificado e não pode ser aberto". A assinatura estava incompleta (`identity: null`); agora o pacote inteiro é assinado ad-hoc (sem hardened runtime), e o macOS mostra o aviso normal de desenvolvedor não verificado, com "Abrir mesmo assim".
- README: passo a passo do Homebrew (instalar, liberar a primeira abertura, atualizar, reinstalar por cima do `.dmg`, remover).

## [1.2.0] — 12/10/2026

- **Windows no CI completo:** testes de integração e E2E também no Windows (os fakes viram `.exe` com o Node SEA).
- Correção no Windows: a limpeza da pasta temporária do Claude CLI não esconde mais o erro de tempo esgotado.
- **Comparar com o anterior:** o log do container anterior (`--previous`) aparece ao lado do atual, com os mesmos filtros de nível e texto; útil para CrashLoopBackOff.
- **Abas:** vários pods ou arquivos abertos ao mesmo tempo, cada um com seu stream rodando em segundo plano; "+" abre uma aba nova e ⌘/Ctrl+clique (ou clique do meio) num pod abre direto numa aba nova; até 8 abas.
- **Tradução completa:** mensagens de erro do kubectl, títulos dos grupos de erro do catálogo e respostas da IA seguem o idioma escolhido (pt-BR, pt-PT, inglês, espanhol); a "Estimativa da IA" é lida em qualquer um deles.
- **Pods recentes:** os últimos 5 pods abertos aparecem em "Recentes" na barra lateral e reabrem no mesmo container; se o pod foi recriado, o app avisa e abre o namespace.

## [1.1.0] — 12/10/2026

### Multiplataforma

- **Linux** (AppImage, `.deb`, `.rpm`, x64), **Windows** (instalador `.exe`, x64) e **macOS Intel** (`.dmg`/`.zip` x64), além do Apple Silicon.
- Código de plataforma isolado em `src/platform/` (G10 atualizado e verificado pelo guardrails): PATH extra de cada sistema, busca de `.exe` no Windows (nunca `.cmd`/`.bat`, que exigiriam shell), dica de instalação do kubectl por sistema.
- Chaves de IA no cofre de cada sistema: Keychain (macOS), DPAPI (Windows), GNOME Keyring/KWallet (Linux) via `safeStorage`; no Linux sem cofre a chave não é gravada.
- Atalhos com Ctrl no Windows e no Linux (rótulos trocam ⌘ por Ctrl); sem barra de menu fora do macOS; ícone na janela e na barra de tarefas.
- CI em macOS, Linux (xvfb) e Windows; `.gitattributes` mantém LF (os logs de teste dependem disso).
- Release automática: tag `v*` gera os pacotes nos três sistemas e anexa à Release com os checksums.
- ADR 0003.
- Homebrew: `brew install --cask wisecort/tap/logdeck` (tap em github.com/wisecort/homebrew-tap, instala o `kubectl` junto); `make tap VERSION=x.y.z` atualiza o cask a partir dos checksums da release.

## [1.0.0] — 12/10/2026

Primeira versão pública (macOS, Apple Silicon). As seções abaixo registram cada fase do desenvolvimento.

### Fase 1 — Governança

- Identidade do app: LogDeck (`package.json`, bundle id `io.github.wisecort.logdeck`), licença MIT.
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

### Fase 6.5 — UI/UX (referência: vídeo do Logui)

- Barra lateral em árvore (contextos → namespaces → pods → containers) com status, favoritos, linhas marcadas, shells e seletor de tema.
- Seis temas: Escuro (padrão), Meia-noite, Claro, Sistema, Solarizado e Alto contraste.
- Barra de cima enxuta (busca com contador e `Aa`/`.*`, Excluir, Presets, Tempo, Limpar filtros); pílulas de nível com "Todos"; ações por ícone; pílula Seguindo/Pausado com pausa automática.
- Histograma de volume por nível com filtro por intervalo (arrastar); linhas de uma linha com painel Detalhes; exportar linhas filtradas.
- Aba IA no painel direito: pergunta livre, perguntas de acompanhamento, contexto por linha/grupos/linhas visíveis, "Estimativa da IA"; diff com números de linha e "Copiar diff".
- Barra de status com estado, localização, contagem e provedor de IA; atalhos (`?`, `Esc`).
- Correção: o histograma e o filtro de tempo usam o relógio do kubectl (o Laravel em UTC−3 esticava o eixo).
- E2E: 16 cenários, incluindo detalhes, histograma, temas, marcadas, favoritos e IA com acompanhamento.

### Fase 6.6 — Contextos e arquivo

- Seletor de contexto único no topo da barra lateral (lembra o último); "Gerenciar contextos…" oculta contextos no LogDeck e copia o comando `kubectl config delete-context` para o usuário rodar; nomes `projeto/host:porta/usuário` aparecem encurtados.
- Procurar pod ou namespace na árvore.
- "Copiar para chamado" na aba Detalhes (pod, horários em UTC, nível e linha, com segredos mascarados); cópias passam pelo main (`clipboard:copy-text`), que funciona sem foco na janela.
- Faixa de produção (G5) mais fina, só com "PRODUÇÃO".
- Abrir log de arquivo (⌘O, botão ou arrastar para a janela), com limite de 200 MB e recusa de arquivo vazio ou binário.
- Commits sem o trailer `Co-Authored-By` (histórico local reescrito antes do primeiro push).

### Fase 6.7 — Preferências, temas e idiomas

- Tela de Preferências (tema, idioma, Sobre) no rodapé da barra lateral; o seletor de tema saiu do rodapé.
- Oito temas novos: Dracula, Nord, Monokai, Gruvbox, One Dark, Tokyo Night, Catppuccin Mocha e GitHub claro.
- Interface em pt-BR, pt-PT, inglês e espanhol (dicionários com as mesmas chaves e placeholders, verificados por teste); menu nativo traduzido via `app:set-language`.
- Créditos: "Feito por Matheus Corteletti — Wise" em Preferências → Sobre, no painel Sobre do macOS e no `package.json`.
- "Seguindo" virou "Ao vivo"; botão "Terminal" com texto; ícone duplicado de "Ir para o fim" removido e exportar com ícone próprio; status "Conectado".
- Renomear contextos só no LogDeck (apelido) e nomes curtos para EKS (`cluster (EKS · região)`, sem número da conta) e GKE.
- Temas: saem Solarizado, Gruvbox, Monokai, One Dark e GitHub claro (parecido com o Claro); entra Matrix (estilo hacker). Quem usava um tema removido volta ao Escuro.
- Correções: "Gerenciar contextos" abre por cima da janela inteira (portal) com nome, apelido e botões visíveis; a seção "Sobre" das Preferências mostra uma informação por linha.
- Menu do macOS enxuto (LogDeck, Editar, Janela), sem Visualizar, Ditado e Emojis.
- Sobre: botões GitHub e LinkedIn (endereços fixos no main), repositório clicável, nome do autor uma vez só, sem "Inspirado no Logui"; licença e documentos em nome de Matheus Corteletti.
- Tema Matrix removido. Exportar com ícone de download; "Ir para o topo" virou pausar/retomar.
- Ícone do app (proposta "Deck": cartões empilhados com linhas de log e a linha de erro em destaque), com mais duas propostas em `build/icon-src/` (Lente e Pulso); `make icon` gera `build/icon.png` e `build/icon.icns` só com ferramentas do macOS (Quick Look, sips, iconutil). No `make dev`, o Dock mostra o mesmo ícone.
- README sem a linha "Inspirado no Logui".
- Ícone: cantos transparentes (o Quick Look desenhava sobre branco; `scripts/icon-mask.mjs` recorta o quadrado arredondado da grade da Apple) e Deck redesenhado com cartão e linhas maiores.

### Lançamento 1.0.0

- Versão 1.0.0; pacotes `.dmg` e `.zip` para Apple Silicon (`npm run release:mac`), sem assinatura da Apple.
- README com instalação, uso, atalhos, IA, segurança e build a partir do código.
- Correção (achada pelo primeiro CI no GitHub): os popovers Presets e Tempo fecham ao clicar fora ou com Esc; antes ficavam abertos e cobriam a barra de ações em janelas menores.
