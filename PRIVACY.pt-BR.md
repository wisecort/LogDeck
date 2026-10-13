<p align="right"><a href="PRIVACY.md">🇺🇸 Read in English</a></p>

# Política de privacidade

O LogDeck é um app de desktop que roda no seu computador. Ele não tem conta, telemetria, analytics, relatório de falhas nem verificação automática de atualização.

**Este programa não transfere nenhuma informação para outros sistemas em rede, a não ser quando o usuário, ou quem instala ou opera o programa, pede isso explicitamente.**

## Com o que o LogDeck se conecta

| Conexão | Quando | O que é enviado |
|---|---|---|
| **Seu cluster Kubernetes/OKD**, pelo `kubectl` instalado na sua máquina | quando você escolhe um contexto ou abre um namespace ou pod | pedidos somente leitura (`get`, `logs`, `auth can-i`) feitos com o seu kubeconfig. O endereço e as credenciais do cluster vêm do kubeconfig; o LogDeck não os lê nem guarda |
| **O provedor de IA que você configurou** (opcional, desligado por padrão) | só depois de você clicar em **Preparar envio**, revisar o preview mascarado e clicar em **Enviar** | as linhas de log que você escolheu, com senhas, tokens, e-mails e, se quiser, IPs internos mascarados, e a sua pergunta |
| **GitHub ou LinkedIn**, no navegador | só quando você clica nesses links em Preferências → Sobre | nada além do que o navegador envia ao abrir uma página |

Os provedores de IA tratam o texto pelas próprias políticas de privacidade: a Anthropic (Claude Code CLI ou API da Anthropic) ou o provedor compatível com OpenAI cuja URL você informou. Com um provedor local (Ollama, LM Studio), o texto não sai da sua máquina.

## O que o LogDeck guarda no seu computador

- **Preferências:** tema, idioma, favoritos, pods recentes, contextos ocultos e apelidos de contexto, presets de exclusão e configuração da IA (provedor, modelo, URL). Ficam na pasta de dados do app e não são enviadas a lugar nenhum.
- **Chaves de API de IA:** só no cofre do sistema (Keychain no macOS, DPAPI pelo safeStorage do Electron no Windows, GNOME Keyring/KWallet no Linux). Nunca ficam em texto puro e nunca são mostradas de novo.
- **Logs:** ficam na memória enquanto o app está aberto. Só vão para o disco quando você escolhe **Exportar** ou salva uma resposta da IA.

Para apagar tudo, desinstale o app e remova a pasta de dados (no macOS, `brew uninstall --zap --cask logdeck` faz as duas coisas).

## Mudanças e contato

As mudanças nesta política ficam no histórico do repositório. Dúvidas: abra uma issue em https://github.com/wisecort/LogDeck/issues.
