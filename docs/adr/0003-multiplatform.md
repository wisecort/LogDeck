# ADR 0003 — macOS, Linux e Windows

- **Status:** aceito (12/10/2026)
- **Autor:** Matheus Corteletti
- **Relacionado:** GUARDRAILS G2/G10, ADR 0002, SPEC RNF9

## Contexto

A 1.0.0 saiu só para macOS (Apple Silicon). Na 1.1.0 o LogDeck passa a ser publicado também para Linux e Windows, e para Macs Intel.

## Decisão

- **Código de plataforma só em `src/platform/`** (G10, verificado pelo `guardrails.mjs`): PATH extra de cada sistema, busca de executáveis (no Windows só `.exe`/`.com`; `.cmd`/`.bat` exigiriam shell, o que o G2 proíbe), dica de instalação do kubectl, rótulos de atalho (⌘ no macOS, Ctrl no resto) e a escolha do cofre das chaves.
- **Chaves de IA:** macOS continua no Keychain (ADR 0002). Windows e Linux usam o `safeStorage` do Electron (DPAPI no Windows; libsecret ou KWallet no Linux) num arquivo criptografado em `userData`. Se o Linux não tiver cofre (`basic_text`), a chave não é gravada e a tela explica o que instalar.
- **Menu:** macOS mantém o menu enxuto; Windows e Linux ficam sem barra de menu.
- **Pacotes:** macOS `.dmg`/`.zip` (arm64 e x64), Linux AppImage/`.deb`/`.rpm` (x64), Windows instalador NSIS (x64, por usuário). Sem assinatura de código.
- **CI:** o harness roda em macOS, Linux (com xvfb) e Windows. No Windows os fakes de `tests/bin` (scripts Node com `#!`) viram `.exe` com o Node SEA (`scripts/build-test-bins.mjs`), porque o app não usa shell (G2); assim integração e E2E também rodam lá.
- **Release:** uma tag `v*` dispara `.github/workflows/release.yml`, que gera os pacotes nos três sistemas e anexa à Release do GitHub com os checksums.

## Consequências

- O `kubectl` precisa estar instalado em cada sistema (Homebrew, snap/pacote da distribuição, winget).
- Sem assinatura: o macOS mostra o aviso de desenvolvedor não verificado e o Windows mostra o SmartScreen.
