# Microsoft Store

O LogDeck também é distribuído pela Microsoft Store como pacote appx/MSIX. A Store **assina o pacote na publicação**: não precisamos de certificado, e o Windows não mostra o aviso do SmartScreen para quem instala pela Store.

## Identidade (Partner Center)

Conta de desenvolvedor individual; produto do tipo "Aplicativo MSIX ou PWA". Os valores ficam em `build.appx` no `package.json` e precisam ser **idênticos** aos do Partner Center (Product management → Product identity), senão o envio é recusado.

| Campo | Valor |
|---|---|
| `Package/Identity/Name` | `Wise-MatheusCorteletti.LogDeck` |
| `Package/Identity/Publisher` | `CN=D4F46613-515E-4C0F-93FD-166EB4FD4CE5` |
| `PublisherDisplayName` | `Wise - Matheus Corteletti` |
| Package Family Name | `Wise-MatheusCorteletti.LogDeck_3jew6k576s190` |
| ID da Store | `9P5LTZ7FBWC4` |

## Como o pacote é gerado

- `npm run build && npm run release:store` gera `release/LogDeck-<versão>-x64.appx`. Só funciona no Windows (usa o `makeappx` do Windows SDK).
- O CI gera o pacote no job do Windows de todo PR (artefato `LogDeck-store-appx`, guardado por 14 dias) e o workflow de release gera em cada tag (artefato `LogDeck-vX.Y.Z-store-appx`). O pacote **nunca** vai para a release do GitHub: sem a assinatura da Store, ele só instala em modo desenvolvedor.
- Logos: `scripts/build-appx-assets.sh` gera `build/appx/*.png` (escala 100 e 200) a partir de `build/icon.png`. O `make icon` roda esse script.
- Na cópia da Store, o aviso de versão nova nunca consulta o GitHub (`src/platform/distribution.ts`): quem atualiza é a Store.

## Testar no Windows antes de enviar

O pacote sem assinatura não instala com dois cliques. Para testar, registre a pasta do pacote em modo desenvolvedor:

1. **Modo desenvolvedor:** Configurações → Sistema → Para desenvolvedores → ligar "Modo de desenvolvedor".
2. **Baixar o pacote:** no PR, abra a execução do CI → artefato `LogDeck-store-appx`. Ou, com o GitHub CLI: `gh run download <id-da-execução> -n LogDeck-store-appx`.
3. **Registrar** (PowerShell, na pasta do download):
   ```powershell
   Copy-Item .\LogDeck-*-x64.appx .\LogDeck.zip
   Expand-Archive .\LogDeck.zip -DestinationPath .\LogDeck-appx -Force
   Add-AppxPackage -Register .\LogDeck-appx\AppxManifest.xml
   ```
4. Abra **LogDeck** pelo menu Iniciar.
5. **Remover depois do teste:** `Get-AppxPackage *LogDeck* | Remove-AppxPackage` (apaga também as preferências da cópia da Store).

### O que conferir

- [ ] O app abre pelo menu Iniciar, com o ícone certo no menu e na barra de tarefas.
- [ ] Acha o `kubectl` instalado pelo winget (`winget install -e --id Kubernetes.kubectl`) e lista os contextos.
- [ ] Um contexto que usa plugin de login (`aws`, `gke-gcloud-auth-plugin`, `oc`, `kubelogin`) lista namespaces e pods. Apps MSIX podem receber só o PATH da máquina; se o plugin não for achado, anote onde ele está instalado.
- [ ] Log ao vivo de um pod, filtros e busca.
- [ ] Terminal do pod (P5, `node-pty`): abre, digita, redimensiona.
- [ ] Abrir arquivo de log (Ctrl+O e arrastar).
- [ ] Preferências (tema, idioma) continuam depois de fechar e abrir.
- [ ] Chave de IA salva (DPAPI) continua depois de fechar e abrir.
- [ ] Mesmo com o aviso de versão nova ligado, a barra de status nunca mostra "X.Y.Z disponível". A pergunta do aviso ainda aparece na tela inicial; escondê-la na cópia da Store exige um canal novo de IPC, que fica para depois.

## Enviar para a Store

No Partner Center, no produto LogDeck → **Iniciar envio**:

1. **Pacotes:** enviar o `.appx` da release (artefato `LogDeck-vX.Y.Z-store-appx`).
2. **Descrição:** a regra 10.2.4 exige declarar a dependência **no começo** da descrição. Primeira linha: "Requires kubectl (install with `winget install -e --id Kubernetes.kubectl`) and access to a Kubernetes or OKD/OpenShift cluster."
3. **Política de privacidade:** `https://github.com/wisecort/LogDeck/blob/main/PRIVACY.md`.
4. **Capturas:** as de `docs/images/en/` (inglês) e `docs/images/` (português).
5. **Classificação etária:** questionário do Partner Center (o app não tem conteúdo de usuários nem compras).
6. **Notas para certificação:** explicar que o app precisa de `kubectl` e de um cluster; que é só leitura; e que sem cluster dá para testar abrindo um arquivo de log (Ctrl+O).

A certificação costuma levar de 1 a 3 dias úteis.
