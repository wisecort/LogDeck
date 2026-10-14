# Contributing to LogDeck

Thanks for your interest! Bug reports, ideas and pull requests are welcome.

## Before you start

- **Bugs and ideas:** open an [issue](https://github.com/wisecort/LogDeck/issues/new/choose) first, so we can agree on the approach before you write code.
- **Security problems:** do not open an issue; see [SECURITY.md](SECURITY.md).
- **Never paste real cluster data** (logs, kubeconfig, tokens, internal hostnames or IPs) in issues, PRs or test fixtures. Use fictional values such as `10.0.0.x` and `example.internal`.

## Running it

Node 22 or newer (the project uses the version in `.nvmrc`):

```bash
npm ci
make dev       # run the app in development mode
make test      # unit and integration tests
make harness   # the full pipeline, same as CI
```

The tests never touch a real cluster: they use a fake `kubectl` (`tests/bin/`) and fictional logs (`tests/fixtures/`).

## Rules for changes

The full rules are in [`AGENTS.md`](AGENTS.md), [`GUARDRAILS.md`](GUARDRAILS.md) and [`SPEC.md`](SPEC.md) (in Portuguese). The short version:

- **Read-only on the cluster.** kubectl only runs with the allowlisted verbs; anything else is blocked in code, and `scripts/guardrails.mjs` fails the build if that changes.
- **Test first.** Write the failing test, then the fix or feature.
- **`make harness` must be green** before a PR is ready (lint, types, guardrails, tests, build, E2E, dependency audit, secret scan).
- **Conventional Commits** in English: `feat(logs): ...`, `fix(shell): ...`, `docs(readme): ...`.
- **Platform-specific code** only in `src/platform/`.
- **New dependency?** Justify it (name, reason, license) in `docs/dependencies.md` and in the PR.
- **Docs in two languages:** `README.md`, `PRIVACY.md` and `CHANGELOG.md` have Portuguese copies (`*.pt-BR.md`); change both. Add your change to `[Unreleased]` in both changelogs.

## About AI assistance

This project is developed with the help of AI coding assistants (Claude Code), openly. `AGENTS.md` holds the rules they must follow, and every change, human or AI, goes through the same harness and review. AI-assisted contributions are welcome under the same rules: you are responsible for what you submit, and you should understand and be able to explain it.

## Code of conduct

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
