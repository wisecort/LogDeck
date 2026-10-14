# Security policy

LogDeck runs `kubectl` with your kubeconfig, so security reports matter a lot to us.

## Supported versions

Only the latest release gets fixes. Please update before reporting: [latest release](https://github.com/wisecort/LogDeck/releases/latest).

## Reporting a vulnerability

**Please do not open a public issue.** Report it privately on GitHub: **Security → Report a vulnerability** ([direct link](https://github.com/wisecort/LogDeck/security/advisories/new)).

Helpful to include:

- the LogDeck version and your OS;
- what an attacker could do and the steps to reproduce;
- a minimal, **fictional** log or setup. Never send a real kubeconfig, token, certificate or real cluster logs.

You should get a first answer within 7 days. Once a fix is released, the advisory is published and you are credited, unless you prefer otherwise.

## What counts

Anything that breaks the promises in the [Security section of the README](README.md#security), for example:

- LogDeck running a kubectl verb outside the read-only allowlist, or `config use-context`;
- reading or sending kubeconfig contents, tokens or certificates;
- log content being executed or treated as instructions (in the UI or by the AI feature);
- data sent anywhere without the user's click (see [PRIVACY.md](PRIVACY.md));
- command injection through namespace, pod or container names.
