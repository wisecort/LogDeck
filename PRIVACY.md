<p align="right"><a href="PRIVACY.pt-BR.md">🇧🇷 Leia em português</a></p>

# Privacy policy

LogDeck is a desktop app that runs on your computer. It has no account, no telemetry, no analytics and no crash reporting. The new-version check is off until you turn it on.

**This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it.**

## What LogDeck connects to

| Connection | When | What is sent |
|---|---|---|
| **Your Kubernetes/OKD cluster**, through the `kubectl` installed on your machine | when you pick a context, open a namespace or a pod | read-only requests (`get`, `logs`, `auth can-i`) made with your own kubeconfig. The cluster address and credentials come from your kubeconfig; LogDeck does not read or store them |
| **The AI provider you configured** (optional, off by default) | only after you click **Prepare to send**, review the masked preview and click **Send** | the log lines you chose, with passwords, tokens, e-mails and (optionally) internal IPs masked, and your question |
| **GitHub's public API** (`api.github.com/repos/wisecort/LogDeck/releases/latest`), for the new-version notice (optional) | only if you answered **Notify me** on the welcome screen or turned it on in Preferences → Updates; at most once a day | one anonymous GET with no cookies, account or identifier. GitHub sees your IP address, as with any web request. LogDeck never downloads or installs anything by itself: it only tells you a new version exists and how to update |
| **GitHub or LinkedIn** in your browser | only when you click those links in Preferences → About | nothing beyond what your browser sends when opening a page |

AI providers process the text under their own privacy policies: Anthropic (Claude Code CLI or Anthropic API), or the OpenAI-compatible provider whose URL you entered. With a local provider (Ollama, LM Studio) the text never leaves your machine.

## What LogDeck stores on your computer

- **Preferences:** theme, language, favorites, recent pods, hidden contexts and context aliases, exclusion presets, AI settings (provider, model, URL) and the update-check choice with the last version seen. They stay in the app's data folder and are never sent anywhere.
- **AI API keys:** only in the system secret store (Keychain on macOS, DPAPI via Electron safeStorage on Windows, GNOME Keyring/KWallet on Linux). They are never written in plain text and never shown again.
- **Logs:** kept in memory while the app is open. They are written to disk only when you choose **Export** or save an AI answer.

To delete everything, uninstall the app and remove its data folder (on macOS, `brew uninstall --zap --cask logdeck` does both).

## Changes and contact

Changes to this policy are recorded in the repository history. Questions: open an issue at https://github.com/wisecort/LogDeck/issues.
