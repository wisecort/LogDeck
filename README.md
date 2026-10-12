# LogDeck

Explorador de logs de Kubernetes/OKD para **macOS, Linux e Windows**, **somente leitura**. Escolha o contexto, o namespace e o pod, acompanhe o log ao vivo, filtre por nível e por texto, veja os erros agrupados e, se quiser, peça para uma IA explicar o que está acontecendo.

> **English:** LogDeck is a read-only Kubernetes/OKD log explorer for macOS, Linux and Windows. Pick a context, namespace and pod, follow the log live, filter by level and text, see grouped errors and optionally ask an AI to explain them. The interface is available in English, Spanish and Portuguese (Preferences → Language).

![LogDeck](docs/images/main.png)

## Recursos

- **Log ao vivo** com reconexão automática, até 50 mil linhas na memória, sem travar a tela.
- **Níveis com cores** (TRACE, DEBUG, INFO, WARN, ERROR, FATAL) reconhecidos em JSON, Laravel, Apache, Nginx, PHP-FPM, Java e texto livre; stack traces ficam juntos da linha de origem.
- **Busca** por texto ou regex (com proteção contra regex que trava), **exclusões** e presets por namespace (por exemplo, esconder health checks).
- **Histograma de volume** por nível: arraste sobre as barras para filtrar um intervalo de tempo.
- **Painel de erros e timeouts**: agrupa erros repetidos (timeout Apache → PHP-FPM, `max_children`, permissão, conexão com banco…) com contagem e período.
- **Detalhes da linha**: horários do log e do kubectl, campos, JSON formatado, stack trace, **Copiar para chamado** (com senhas e tokens mascarados).
- **Container anterior** (`--previous`) para investigar CrashLoopBackOff, inclusive **lado a lado** com o log atual.
- **Abas** e **pods recentes** para alternar entre vários pods.
- **Terminal no container**, aberto só quando você clica.
- **Abrir arquivo de log** salvo (⌘O ou arrastando para a janela).
- **IA opcional** para explicar erros, com preview do texto mascarado e do destino antes de qualquer envio.
- **Contextos**: um por vez, com renomear e ocultar só no LogDeck (o kubeconfig nunca é alterado); nomes do EKS e do GKE encurtados.
- **9 temas** (Escuro, Meia-noite, Claro, Sistema, Alto contraste, Dracula, Nord, Tokyo Night, Catppuccin) e **4 idiomas** (português do Brasil, português de Portugal, inglês e espanhol).

## Instalação

### Requisitos

- `kubectl` instalado:

  | Sistema | Comando |
  |---|---|
  | macOS | `brew install kubectl` |
  | Linux | `sudo snap install kubectl --classic` ou o pacote `kubectl` da sua distribuição |
  | Windows | `winget install -e --id Kubernetes.kubectl` |

- Um kubeconfig com acesso ao cluster (o arquivo padrão `~/.kube/config` ou a variável `KUBECONFIG`). No OKD/OpenShift, basta fazer `oc login` antes.

### Baixar

Todos os arquivos estão na página de [Releases](https://github.com/wisecort/LogDeck/releases), com os checksums SHA-256.

**macOS** (Apple Silicon ou Intel)

#### Pelo Homebrew (recomendado)

O Homebrew baixa a versão certa para o seu Mac (Apple Silicon ou Intel) e instala o `kubectl` junto.

1. Instale:
   ```bash
   brew install --cask wisecort/tap/logdeck
   ```
2. Na primeira vez, o macOS avisa que não consegue verificar o desenvolvedor (o app ainda não é assinado pela Apple). Libere com:
   ```bash
   xattr -dr com.apple.quarantine /Applications/LogDeck.app
   ```
   Ou abra o LogDeck uma vez, feche o aviso e vá em **Ajustes do Sistema → Privacidade e Segurança → Abrir mesmo assim**.
3. Abra o **LogDeck** pelo Launchpad ou pelo Spotlight.

| Para | Comando |
|---|---|
| Atualizar para a versão mais nova | `brew update && brew upgrade --cask logdeck` |
| Ver a versão instalada | `brew info --cask logdeck` |
| Já tem o LogDeck em Aplicativos (instalado pelo `.dmg`) | `brew install --cask --force wisecort/tap/logdeck` |
| Remover | `brew uninstall --cask logdeck` |
| Remover tudo, inclusive preferências e contextos renomeados | `brew uninstall --zap --cask logdeck` |

Depois de atualizar, rode de novo o `xattr` do passo 2 se o macOS voltar a avisar.

#### Manualmente (`.dmg`)

1. Baixe `LogDeck-<versão>-arm64.dmg` (M1 ou mais novo) ou `LogDeck-<versão>-x64.dmg` (Intel).
2. Abra o `.dmg` e arraste o **LogDeck** para **Aplicativos**.
3. Na primeira vez, o macOS avisa que não consegue verificar o desenvolvedor (o app ainda não é assinado pela Apple). Para liberar, abra o LogDeck uma vez, feche o aviso e vá em **Ajustes do Sistema → Privacidade e Segurança → Abrir mesmo assim**. Ou, no Terminal:
   ```bash
   xattr -dr com.apple.quarantine /Applications/LogDeck.app
   ```

**Linux** (x64)

- Debian/Ubuntu: `sudo apt install ./LogDeck-<versão>-<arq>.deb`
- Fedora/RHEL: `sudo dnf install ./LogDeck-<versão>-<arq>.rpm`
- Qualquer distribuição: `chmod +x LogDeck-<versão>-<arq>.AppImage` e abra o arquivo

Para guardar chaves de IA, o Linux precisa de um cofre de senhas ativo (GNOME Keyring ou KWallet). Sem ele, o LogDeck funciona, mas não grava chaves.

**Windows** (x64)

1. Baixe e rode o instalador `LogDeck-<versão>-<arq>.exe`. A instalação é só para o seu usuário e não pede administrador.
2. O app ainda não é assinado: se o SmartScreen avisar, clique em **Mais informações → Executar assim mesmo**.

## Como usar

### 1. Escolher contexto, namespace e pod

- No topo da barra lateral, o seletor **Contexto** começa no contexto atual do seu kubeconfig. Contextos com `prod` ou `prd` no nome aparecem com a marca **PROD** e uma faixa vermelha no topo da janela.
- Abaixo aparecem os **namespaces**. Clique para ver os pods (bolinha verde: rodando; vermelha: com problema; ↻ = restarts).
- Clique no pod. Se ele tiver mais de um container, escolha o container.
- Use **Procurar pod ou namespace** para filtrar a árvore e a ⭐ para favoritar namespaces.
- Sem permissão para listar namespaces (comum no OKD)? Digite o nome do namespace e tecle Enter.

### 2. Acompanhar o log

- O log abre **ao vivo**. Ao rolar para cima ou clicar numa linha, a tela **pausa** (o log continua chegando). Clique em **Ao vivo** ou no ▶ para voltar.
- **Níveis:** clique para ligar ou desligar; ⌥+clique mostra só aquele nível.
- **Buscar** (⌘F): texto, `Aa` para diferenciar maiúsculas e `.*` para regex. ⌘G / ⇧⌘G pula entre os resultados.
- **Excluir:** termos separados por vírgula. Em **Presets** você salva exclusões por namespace.
- **Tempo:** quantas linhas trazer (tail), desde quando e **Container anterior (`--previous`)**.
- **Comparar com o anterior** (ícone de colunas): mostra o log do container anterior ao lado do atual.
- **Histograma:** arraste sobre as barras para ver só aquele intervalo.
- Na barra de ações: colapsar repetidas, quebrar linhas, **exportar** as linhas filtradas, pausar, limpar a tela e **Terminal**.

![Detalhes de uma linha](docs/images/details.png)

### Abas

Clique em **+** acima da busca para abrir outra aba, ou faça ⌘-clique (Ctrl-clique no Windows/Linux) num pod para abri-lo direto numa aba nova. Cada aba continua recebendo o log em segundo plano. Até 8 abas.

### 3. Investigar erros

- A aba **Erros** agrupa os erros e timeouts. Clique num grupo para filtrar o log por ele.
- Clique numa linha para abrir **Detalhes**: horários, campos, JSON, stack trace, **Copiar** e **Copiar para chamado** (pod, horários em UTC, nível e a linha, com segredos mascarados).
- **Marcar** guarda a linha na seção **Marcadas** da barra lateral.

### 4. Abrir um arquivo de log

Use ⌘O, o botão **Abrir arquivo de log…** ou arraste o arquivo para a janela. Funciona com logs exportados com ou sem `kubectl logs --timestamps`, até 200 MB. Nenhuma chamada ao cluster é feita.

### 5. Gerenciar contextos

No seletor de contexto, escolha **Gerenciar contextos…** para:

- **renomear** um contexto só no LogDeck (por exemplo, trocar um ARN longo do EKS por `eks-cluster`);
- **ocultar** contextos que você não usa;
- copiar o comando `kubectl config delete-context` para remover de vez no seu terminal. O LogDeck nunca altera o kubeconfig.

### 6. IA (opcional)

Configure em **IA** (rodapé da barra lateral). Provedores:

| Provedor | Custo | Onde o texto é processado |
|---|---|---|
| **Claude Code CLI** (`claude`) | sem custo extra com assinatura Pro/Max | Anthropic |
| **API da Anthropic** | por token (chave no cofre do sistema) | Anthropic |
| **API compatível com OpenAI**: Ollama, LM Studio, DeepSeek, OpenRouter, Groq ou URL própria | grátis (local) ou do provedor | na sua máquina ou no provedor escolhido |

Na aba **IA**, escolha o contexto (linha selecionada com as vizinhas, grupos de erro marcados ou linhas visíveis), faça uma pergunta se quiser e clique em **Preparar envio**. Você vê o texto **mascarado** (senhas, tokens, e-mails e, se quiser, IPs internos) e o **destino** antes de clicar em **Enviar**. Nada é enviado sozinho. A resposta traz uma "Estimativa da IA", que pode estar errada; comandos que alterariam o cluster aparecem riscados e nunca são executados.

Se o log tiver dados pessoais ou sensíveis, avalie a LGPD e a política da sua organização antes de usar um provedor hospedado.

### 7. Preferências

Em **Preferências** (rodapé da barra lateral): tema, idioma e Sobre.

![Preferências](docs/images/preferences.png)

## Atalhos

| Atalho | Ação |
|---|---|
| ⌘O | Abrir arquivo de log |
| ⌘F | Buscar |
| ⌘G / ⇧⌘G | Próxima / anterior linha encontrada |
| ⌥ + clique no nível | Mostrar só aquele nível |
| ⌘ + clique no pod | Abrir o pod numa nova aba |
| Esc | Limpar seleção / fechar |
| ? | Lista de atalhos |

No Windows e no Linux, use Ctrl no lugar de ⌘, Shift no lugar de ⇧ e Alt no lugar de ⌥.

## Segurança

O LogDeck foi feito para olhar, não para mexer:

- **Só leitura:** o kubectl só roda com `config get-contexts`, `get`, `logs`, `auth can-i` e `version --client`. Qualquer outro verbo é bloqueado no código. O terminal no container só abre quando você clica.
- **Seu kubeconfig fica intacto:** cada chamada usa `--context`; o app nunca faz `config use-context` nem lê `config view --raw`, tokens ou certificados.
- **Sem shell:** o kubectl é chamado com uma lista de argumentos, e nomes de namespace, pod e container são validados.
- **IA só com clique**, preview e mascaramento. Os logs são tratados como dados, nunca como instruções.
- As chaves de API ficam no **cofre do sistema** (Keychain no macOS, DPAPI no Windows, GNOME Keyring/KWallet no Linux).

As regras completas estão em [`GUARDRAILS.md`](GUARDRAILS.md) e o escopo em [`SPEC.md`](SPEC.md).

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| "kubectl não encontrado" | `brew install kubectl` e abra o LogDeck de novo |
| Nenhum contexto aparece | confira o `~/.kube/config` ou a variável `KUBECONFIG`; no OKD, faça `oc login` |
| Erro de autenticação | o token expirou: faça login de novo no cluster (`oc login`, `aws eks update-kubeconfig`…) |
| Não lista namespaces | falta permissão de listar; digite o nome do namespace e tecle Enter |
| Linhas antigas sumiram | o limite é 50 mil linhas; a barra de status mostra quantas foram descartadas |
| Aviso de desenvolvedor não verificado | veja o passo 3 da [instalação](#baixar) |
| "LogDeck está danificado e não pode ser aberto" (versões até 1.2.0) | o app não está danificado: era a assinatura incompleta. Rode `xattr -dr com.apple.quarantine /Applications/LogDeck.app` ou atualize para a 1.2.1+ |

## Construir a partir do código

Requisitos: Node 22 ou mais novo (o projeto usa Node 26, veja `.nvmrc`) e ferramentas de compilação (no macOS, as do Xcode; no Linux, `build-essential` e `python3`, porque o terminal embutido é compilado na instalação).

```bash
git clone https://github.com/wisecort/LogDeck.git
cd LogDeck
npm ci
make dev          # abre o app em modo desenvolvimento
make harness      # lint, tipos, guardrails, testes, build, E2E, auditoria e segredos
npm run release:mac     # macOS: .dmg e .zip (arm64 e x64)
npm run release:linux   # Linux: AppImage, .deb e .rpm
npm run release:win     # Windows: instalador .exe
```

Os testes nunca acessam um cluster de verdade: usam um `kubectl` falso e logs fictícios. Regras para contribuir (inclusive com assistentes de IA) estão em [`AGENTS.md`](AGENTS.md).

## Licença

[MIT](LICENSE) · Feito por Matheus Corteletti — Wise · [GitHub](https://github.com/wisecort/LogDeck) · [LinkedIn](https://www.linkedin.com/in/cortelettimatheus/)
