# Changelog

**English** · [Português](CHANGELOG.pt-BR.md)

Based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). One entry per phase.

## [Unreleased]

- **A log file that cannot be opened gets a dialog** in the middle of the window instead of the thin notice on top, which was easy to miss (issue #24): what went wrong (empty, too large, not text), the file name, what to do about it, and **Open another file…**. It closes with OK or Esc.
- **Notices on top are easier to see:** red for kubectl and cluster errors (session expired, no permission, cluster unreachable, timeout…), amber for app warnings (tab limit, a recent pod that is gone, no contexts), with an icon, a short title and a brief highlight when they appear. The "recent pod is gone" notice no longer says "Opened its namespace" as if the app were talking.
- **A recent pod that was recreated offers the new one:** when a pod in Recents is gone because its Deployment (or OKD DeploymentConfig) created another one, the notice names the new pod and has **Open the new pod**, which opens it and replaces the old entry in Recents. Same owner and container, running; the same ReplicaSet first, then the newest.
- **Lines kept per live log** can be chosen in Preferences: 10k, 50k (default), 100k, 250k or 500k. It applies to pods opened after the change; the "N old lines dropped" mark shows the chosen limit. The SPEC asked for this (RNF2) but it was fixed at 50k until now.
- **Large log files open in full:** a file is read in chunks with progress in the status bar, and keeps every line instead of the last 50,000. Up to 1 GB (asks first above 500 MB) or 6 million lines; past that, the lines read so far stay and a notice says how much of the file they cover. Search, filters, error groups, the histogram and the AI work on the whole file. Measured on a MacBook: 800 MB with 4.4 million lines in about 18 s. Scrolling up while a file loads no longer freezes the list on the first lines.
- **All replicas in one tab:** in the sidebar, pods of the same StatefulSet, Deployment, OKD DeploymentConfig or DaemonSet are grouped under its name, with **All** to read their logs together. One `kubectl logs -f` per pod (the same command as for a single pod, nothing new on the cluster), lines merged by time, each tagged with its pod in its own color. Chips above the list show the lines per pod and turn a pod on or off; clicking a pod name on a line opens that pod in its own tab. Pods that join or leave (scale, rollout, recreated replica) are followed and marked in the timeline, and a dropped stream reconnects alone without stopping the others. Up to 10 pods per tab, the newest. The group is one entry in Recents. Asked by a user who did this with `kubectl logs statefulsets/<name>`.
- **Kubeconfig files outside the default:** **Manage contexts…** has **Add file…** and **Add folder…** (system dialog). kubectl reads them through the `KUBECONFIG` list, after the default kubeconfig (your existing `KUBECONFIG`, else `~/.kube/config`), which can be turned off once something else is in the list. From a folder it takes `config`, `.yaml`, `.yml`, `.conf` and `.kubeconfig` files directly in it. LogDeck keeps only the paths and still never reads a kubeconfig; contexts reload right away, and a path that is gone shows "not found". Asked by the same user.

## [1.6.2] — 2026-10-14

- **Kubernetes events in the timeline:** warnings about the pod (failed probes, back-off, OOM, failed mounts…) and the Killing event appear between the log lines at the time they happened, with how many times and from when to when, and as purple diamonds on the histogram. Read with `kubectl get events -n <namespace> -o json` every 5 s while the pod is open and filtered by pod in the app; `events` joins the read-only allowlist (no `--watch`, no field selectors). Without permission to read events nothing is shown.
- **Marks between log lines**, so an empty stretch is never ambiguous: "Connection lost at … back at …" when the kubectl stream dropped (the lines from that stretch are fetched again, without duplicates), "No logs for 2m 10s" when the stream was connected and the container wrote nothing (more than a minute, and 20× the usual gap between lines, so slow jobs are not flagged), "Container … restarted" with the reason, exit code and how long it ran, plus **See previous logs**, and "N old lines dropped" above the oldest line when the 50,000-line buffer is full. The histogram shows restarts as red ticks and stream drops as hatched stretches. Marks hide while searching or filtering by an error group (asked on r/kubernetes).
- **Faster pod opening:** the log's `kubectl logs` starts alone; the extra reads (events, services, routes, ingresses) wait for its first lines (at most 3 s), and events refresh every 15 s instead of 5. Each kubectl process costs a login round trip on OKD.
- **Empty view says why:** when every loaded line is filtered out, the list says how many lines were loaded and how many the presets hide (health checks can fill the whole `--tail`), with **Turn presets off in this namespace** and **Clear filters**.
- **How the pod is reached** (Pod tab → Access): the Services whose selector matches the pod's labels (type and ports) and the URLs of the OKD Routes and Ingresses pointing at them, with a copy button (the app never opens them). Read with `kubectl get services`, `get routes.route.openshift.io` and `get ingresses` when a pod is opened; these join the read-only allowlist. Clusters without the Route API or without permission just show less.
- **Pod tab** in the right panel: the container's state and uptime, restarts, the previous run (reason such as OOMKilled, exit code, how long it ran and when it ended), image, memory and CPU requests and limits, readiness/liveness/startup probes (exec probes show only "command", never the command), node, creation time and QoS. Previous runs seen while the app is open are listed too (Kubernetes keeps only the last one). The status bar shows the container's uptime and restarts. Read from the same `kubectl get pods -o json` the sidebar already refreshes.
- Community files for contributors: `CONTRIBUTING.md` (how to run, rules, AI assistance), `SECURITY.md` (private vulnerability reports), `CODE_OF_CONDUCT.md`, issue templates (bug, feature) and a pull request template.
- Website on GitHub Pages (https://wisecort.github.io/LogDeck/), in English and Portuguese: demo video, screenshots, the read-only promises and downloads per OS (the visitor's OS comes first), with kubectl install commands, a before/after, zoomed details, "and more" features and a FAQ; Retina screenshots from `make site-shots`. Built from `site/` by `scripts/build-site.mjs` and published by `.github/workflows/pages.yml` after each release.
- LogDeck is on the [Microsoft Store](https://apps.microsoft.com/detail/9P5LTZ7FBWC4) (published with 1.6.0): signed by Microsoft, no SmartScreen warning, updated by the Store. Both READMEs show the Store badge and recommend it for Windows.

## [1.6.1] — 2026-10-13

- Fix: on Linux the `.deb`/`.rpm` showed a generic gear instead of the LogDeck icon (GNOME and other desktops). The package now ships the icon in the standard sizes (16 to 512 px, `build/icons/`, made by `make icon`), and the launcher description is in English and no longer says "macOS" only.
- **Copy with details** follows "Mask sensitive data": it also hides the context name (cluster host and user) and internal IPs. Fix: its "Copied" label now goes back after 2 s instead of staying.

## [1.6.0] — 2026-10-13

- **Microsoft Store package (appx/MSIX):** `npm run release:store` builds it (`build.appx` with the Partner Center identity, Store logos in `build/appx/` made by `scripts/build-appx-assets.sh`, also run by `make icon`). CI builds it on every PR and on each release as a workflow artifact (never a release asset: the Store signs it on submission). Testing and submission steps in `docs/microsoft-store.md`.
- The Microsoft Store copy never checks GitHub for new versions: the Store updates it (`src/platform/distribution.ts`).
- **No kubectl? The welcome screen says how to install it:** a highlighted card with the install command for the OS (winget, brew, snap), a **Copy** button and **Check again**, which finds kubectl without restarting the app; meanwhile log files can already be opened. README lists how to install `oc` too.
- **Home is the house button:** the app opens on the home screen with the button lit and no tab; tabs are only for pods, files and builds. The house shows the home screen and leaves the open tabs running (it used to empty the current tab and stop its log). The "+" button is gone: ⌘/Ctrl-click or middle-click a pod opens it in a new tab.
- **Copy with masking:** Details has a "Mask sensitive data" option for **Copy**: it hides passwords, tokens, keys, emails and internal IPs (10.x, 172.16–31.x, 192.168.x) in the copied line and stack trace. Off by default, remembered on this machine; the log on screen does not change.
- "Copy for ticket" is now **Copy with details** (pod, UTC times, level and the line, secrets masked).
- **Wider Preferences:** two columns when there is room (themes on the left; language, updates and About on the right), so everything shows without scrolling in the default window; one column in narrow windows.
- Fix: a missing login plugin (`oc`, `aws`, `gke-gcloud-auth-plugin`, `kubelogin`…) showed "Resource not found (the pod may have been removed)". It now names the plugin and says to install it or check the PATH.
- **CHANGELOG in English** (`CHANGELOG.md`), with the Portuguese version in `CHANGELOG.pt-BR.md`.
- **Release notes with the changes:** each GitHub Release shows its version's section from `CHANGELOG.md` (`scripts/release-notes.mjs`) instead of "see the CHANGELOG", plus the code signing policy link; the release fails if the version has no section.
- README: code signing status updated. The SignPath Foundation declined the first application (the project is too new); releases stay unsigned, and we will reapply once the project has wider adoption.
- Stable shell integration test on Windows: it also resends `exit` when ConPTY drops the first keystrokes.
- README screenshots redone by `make screenshots` (`tests/screenshots`, fake kubectl and fictional logs, English and Portuguese).

## [1.5.0] — 2026-10-12

- **English README** (`README.md`, with English UI screenshots in `docs/images/en/`) and a Portuguese version in `README.pt-BR.md`, linked to each other.
- **winget:** manifests for the `wisecort.LogDeck` 1.4.0 package in `packaging/winget/` (per-user installer, depends on `Kubernetes.kubectl`), ready for the `microsoft/winget-pkgs` PR.
- **Code signing policy** (section in the READMEs) and **privacy policy** (`PRIVACY.md` / `PRIVACY.pt-BR.md`), required to apply for free signing from the SignPath Foundation; every release's notes link to the "Code signing policy".
- **New-version notice** (opt-in only): the welcome screen asks once whether it may notify you; if yes, the main process makes at most one anonymous GET a day to `api.github.com/repos/wisecort/LogDeck/releases/latest` (fixed URL, no credentials, no redirects, response treated as data). When a new version exists, the status bar shows "X.Y.Z available", and the modal shows the Homebrew and winget commands and the release link, with "Skip this version". LogDeck never downloads or installs anything. Toggle it in Preferences → Updates. G6, the privacy policy and the READMEs were updated.
- **Automated winget:** the release workflow opens the "Update: wisecort.LogDeck to X.Y.Z" PR in `microsoft/winget-pkgs` (`scripts/update-winget.sh`, manifests generated by `scripts/winget-manifests.mjs` from the previous version), with no third-party actions; needs the `WINGET_TOKEN` secret. Locally: `make winget VERSION=X.Y.Z`.
- Stable shell integration test on Windows: retypes the command when ConPTY drops the first keystrokes.

## [1.4.0] — 2026-10-12

- **New README** with a visual tour: welcome, details, errors, OKD builds, compare with previous, light theme, Preferences and Shortcuts (screenshots made with fictional data).
- **Recent:** an × on hover removes the pod from the list (saved).
- **Cockpit look:** welcome screen in empty tabs (logo, Pods / File / Last pod cards with shortcuts, context and kubectl status), **Home** button in the tab bar, pulsing live indicator, glass surfaces and accent-color glow.
- Redesigned **Preferences**: themes as thumbnails with their real colors, languages as buttons, About card with logo. **Shortcuts** grouped (General, Search, Mouse) with drawn keys (Ctrl on Windows/Linux).
- **OKD builds** in a folder inside the namespace, after the pods: the build history (`kubectl get builds.build.openshift.io`, read-only) with status, commit, duration and age; opens the log of the build's main container while the pod still exists; when the cluster has already removed the pod, opens a panel with the build details (status, reason, commit, duration) and the `oc describe` command to copy. Deployer pods in the same folder.
- **Production (G5):** no red banner at the top; the PROD badge sits in the context picker and in the status bar.
- **OKD build logs recognized:** parser for buildah/docker/s2i (`STEP n/m`, `-->` layers, `Copying blob`, `COMMIT`, push, `git clone`, `error: build error`, `ERRO:`), with step and instruction as fields; `RUN` output becomes INFO instead of UNKNOWN; "Build failed" rule in the errors panel. Opening a build shows only the build container (no init steps).
- **Finished pods** (completed builds, Jobs) are read once, without `-f`: the app used to reconnect every 1–10 s.
- **Visual polish:** spacing, radius, shadow and typography scales as CSS variables; thin scrollbars; visible keyboard focus and animations that respect `prefers-reduced-motion`.
  - Log lines easier to scan: subdued INFO/DEBUG, WARN/ERROR/FATAL with a filled tag, left marker and lightly tinted background; dimmed milliseconds; selection with an accent border.
  - Single-row level bar (segmented level filters, icon groups with separators, Terminal); **Live / Paused** and pause together at the end of the top bar. Presets and Time as buttons with a counter and a chevron.
  - Sidebar with indent guides in the tree, counters on folders, favorite star only on hover; the pod is subdued when one of its containers is selected.
  - Right panel: segmented tabs, error groups as cards, selected-line header with actions, fields as a table, empty states with an icon; neutral disabled primary button.
  - Tabs with an accent line on the active tab; status bar with a pulsing state dot and a path with separators; narrow window (≤1280 px) gives the log more room.
- kubectl timeout with a useful, translated message (which command took too long and what to check: VPN/network, context login).

## [1.3.0] — 2026-10-12

- **OKD build and deployer pods hidden:** pods created by BuildConfig (`openshift.io/build.name`) and by DeploymentConfig (`openshift.io/deployer-pod-for.name`) are hidden in the tree; "+ N OKD builds/deploys" shows them all, tagged `build`/`deploy`, and the choice is remembered.

## [1.2.1] — 2026-10-12

- Fix: the macOS app downloaded from the internet showed as "damaged and can't be opened". The signature was incomplete (`identity: null`); now the whole bundle is ad-hoc signed (no hardened runtime), and macOS shows the normal unidentified-developer warning, with "Open Anyway".
- README: Homebrew step by step (install, allow the first launch, upgrade, reinstall over the `.dmg`, uninstall).

## [1.2.0] — 2026-10-12

- **Full Windows CI:** integration and E2E tests on Windows too (the fakes become `.exe` files with Node SEA).
- Windows fix: cleaning up the Claude CLI temporary folder no longer hides the timeout error.
- **Compare with previous:** the previous container's log (`--previous`) shows next to the current one, with the same level and text filters; useful for CrashLoopBackOff.
- **Tabs:** several pods or files open at once, each with its stream running in the background; "+" opens a new tab and ⌘/Ctrl+click (or middle click) on a pod opens it straight in a new tab; up to 8 tabs.
- **Full translation:** kubectl error messages, catalog error group titles and AI answers follow the chosen language (pt-BR, pt-PT, English, Spanish); the "AI estimate" is read in any of them.
- **Recent pods:** the last 5 opened pods show under "Recent" in the sidebar and reopen on the same container; if the pod was recreated, the app says so and opens the namespace.

## [1.1.0] — 2026-10-12

### Cross-platform

- **Linux** (AppImage, `.deb`, `.rpm`, x64), **Windows** (`.exe` installer, x64) and **Intel macOS** (`.dmg`/`.zip` x64), in addition to Apple Silicon.
- Platform code isolated in `src/platform/` (G10 updated and checked by guardrails): extra PATH per OS, `.exe` lookup on Windows (never `.cmd`/`.bat`, which would need a shell), kubectl install hint per OS.
- AI keys in each OS's secret store: Keychain (macOS), DPAPI (Windows), GNOME Keyring/KWallet (Linux) via `safeStorage`; on Linux without a secret store the key is not saved.
- Ctrl shortcuts on Windows and Linux (labels swap ⌘ for Ctrl); no menu bar outside macOS; icon on the window and taskbar.
- CI on macOS, Linux (xvfb) and Windows; `.gitattributes` keeps LF (the test logs depend on it).
- Automated release: a `v*` tag builds the packages on the three OSes and attaches them to the Release with checksums.
- ADR 0003.
- Homebrew: `brew install --cask wisecort/tap/logdeck` (tap at github.com/wisecort/homebrew-tap, installs `kubectl` too); `make tap VERSION=x.y.z` updates the cask from the release checksums.

## [1.0.0] — 2026-10-12

First public version (macOS, Apple Silicon). The sections below record each development phase.

### Phase 1 — Governance

- App identity: LogDeck (`package.json`, bundle id `io.github.wisecort.logdeck`), MIT license.
- `SPEC.md` with F1–F7, P1–P5, non-functional requirements and out of scope.
- `GUARDRAILS.md` (G1–G10 and how each rule is checked), `AGENTS.md`, `CLAUDE.md`.
- ADR 0001: greenfield in Electron + TypeScript (Logui source unavailable).
- `docs/backlog-mvp2.md`.

### Phase 2 — Safeguards

- Electron + React + Vite app skeleton (window, menu and bundle as LogDeck; renderer with sandbox, contextIsolation and CSP).
- `scripts/guardrails.mjs` (G1–G10, no dependencies) with tests; `--hook` for Claude Code and an allowlist with mandatory justification.
- `scripts/harness.sh` (10 steps, ✅/❌/⚠️), `Makefile`, `.github/workflows/ci.yml` (macos-latest), `.pre-commit-config.yaml`.
- `.claude/settings.json` (deny list + hook) and the `parser-author`, `security-reviewer`, `test-runner` subagents.
- `docs/dependencies.md` with the reason and license of each dependency.
- The bundle is now named `LogDeck.app` (no `executableName`).

### Phase 3 — Fixtures and red tests

- Anonymized fixtures (G8) for P1–P4: Apache access/error, PHP-FPM, Laravel, JSON (Monolog/pino/zap), Nginx, Java, startup and a realistic OKD pod log with `--timestamps` (475 lines, generated deterministically).
- Fake kubectl (`tests/bin/kubectl`): contexts, namespaces, pods, `logs -f` with delay, `--tail`/`--since-time`/`--previous`, auth error, dropped connection, exec without TTY; refuses write verbs (exit 99). Contract covered by 15 integration tests.
- Unit tests for parsers (7), classify, buffer, search (with ReDoS), signatures, args, contexts and redact, against stubs that throw "not implemented".
- Guardrails: hosts in fixtures are no longer mistaken for Java packages (`java.net.…`).
- SPEC: heuristic with an explicit level token and stack trace continuation rules for Laravel/Java.

### Phase 4 — Log core

- 7 pluggable parsers (JSON/Monolog/pino/zap, Laravel, Apache/Nginx access, Apache 2.2/2.4 error, PHP-FPM, Nginx error, heuristic) with a try order; UNKNOWN in 0.56% of the fixtures (target < 5%).
- `classify`: `--timestamps` prefix (RFC3339Nano), multiline stack traces, log time × k8s time with a warning when they differ by > 2 s; ingestion time never shown (P2).
- `buffer`: 50k ring buffer (1–500k) dropping the oldest lines, per-level counters and lookup by `seq`.
- `search`: text (default) and regex, exclusions, highlighting without HTML; regex with nested quantifiers refused and pathological regex aborted at 250 ms in a disposable worker (F5.4).
- `signatures`: the F6 catalog (Apache → PHP-FPM timeout, startup permission, etc.) and generic grouping by normalized message.
- `src/logs/` coverage: 99% lines, 96% branches.

### Phase 5 — Kubernetes

- `args.ts`: builders and the final `assertReadOnly` gate (allowlist of verbs, resources and flags; `--context` required); DNS-1123 names; context checked against `get-contexts`.
- `contexts.ts`: contexts only through `config get-contexts`, no credentials; production warning (`prod`/`prd`).
- `kubectl.ts`: the only `spawn` (no shell), PATH with Homebrew for apps opened from Finder, actionable messages (kubectl missing, session expired, RBAC, cluster unreachable).
- `pods.ts` and `service.ts`: context → namespace → pod → container navigation with effective status (CrashLoopBackOff, Init:…, Completed), restarts and fallback to the default namespace when RBAC doesn't allow listing (OKD).
- `stream.ts`: live log in 100 ms batches, 1/2/5/10 s reconnect with `--since-time` and no duplicate lines, `--previous`, unrecoverable errors without retry, SIGTERM→SIGKILL on `stop`; `StreamRegistry` ends everything when the window or app closes.
- Typed IPC (`src/shared/ipc.ts`) and the preload API; the renderer doesn't build kubectl arguments and only the main window can call.
- E2E with fake kubectl: navigation, rejection of malicious input from the renderer and no orphan kubectl after closing the app.

### Phase 6 — Interface

- React UI: context → namespace → pod → container navigation, red production banner (G5), Live/Reconnecting/Paused/Ended/Error status, `tail`/`since`/`--previous` options, pause without losing lines, dropped-lines warning.
- F4: level filter with counters (click toggles, ⌥+click isolates).
- F5: text/regex search with ⌘F, ⌘G/⇧⌘G, case sensitivity, exclusions and text-only highlighting (no HTML); regex in a Blob Worker with a 250 ms limit.
- P3: exclusion presets per context+namespace saved in `userData` ("Hide health checks" on by default) and collapsing of repeated lines (×121 in the fixture).
- F6: errors and timeouts panel with count, first/last occurrence, filter by group and selection (for F7).
- P5: Pod Shell with `node-pty` + `xterm.js`, resize forwarded to the PTY, native confirmation in production done in the main process; shells closed when the window/app closes.
- ANSI stripped before parsing (F3.6); virtualized list that follows the end.
- New dependencies: `node-pty`, `@xterm/xterm`, `@xterm/addon-fit`, `@tanstack/react-virtual` (see `docs/dependencies.md`); postinstall fixes the execute bit of node-pty's `spawn-helper`.
- UI E2E: main flow (ERROR → FPM → "Apache → PHP-FPM timeout"), P3, catastrophic regex, production banner, `--previous` and shell with TTY.
- Architecture: log core on the UI thread (SPEC §2 updated); the F6 panel uses the kubectl clock.
- Fix: the `app.spec` E2E opened the app without the fake kubectl and, with the new UI, ran the real `kubectl version --client` and `config get-contexts` (local kubeconfig read, no cluster contact). All E2E now use a fake kubectl and kubeconfig, with a safety net in `playwright.config.ts`.

### Phase 7 — AI ("Explain these errors")

- Three providers in the main process (ADR 0002): **Claude Code CLI** (subscription; `--tools ""`, `--no-session-persistence`, `--strict-mcp-config`, `--permission-mode dontAsk`, stdin, empty temporary `cwd`), **Anthropic API** (`@anthropic-ai/sdk`, `claude-opus-5-5`, `effort: medium`, `fallbacks: "default"`, refusal handling) and **OpenAI-compatible API** (Ollama, LM Studio, DeepSeek, OpenRouter, Groq, custom; HTTPS outside localhost).
- Keys in the macOS Keychain (`/usr/bin/security`), never in the renderer; "Test provider" without logs.
- `redact.ts` (JWT, Bearer, passwords, secrets, AWS/GCP, private keys, credentials in URLs, emails, optional internal IPs), redone in the main process; payload of up to 200 lines / 32 KB with the most recent lines of each group.
- Mandatory preview with the destination; single send per preview id (expires in 10 min); log delimited in `<logs>` and declared as data in the system prompt.
- Answer shown as text: suggested write commands are struck through, with a warning and no copy button; diffs can only be saved to a local file chosen by the user.
- Guardrails: network and AI SDK only in `src/ai/providers/`; `bypassPermissions`/`acceptEdits`/`--dangerously-*`/`--tools default` blocked; justified exception for the detector's verb list.
- Tests with fake `claude`, `security` and HTTP servers; authorized manual tests with the real Claude Code and the Anthropic API (fictional fixture text) passed.
- Harness 100% green: 512 unit, 92 integration, 12 E2E; `redact.ts` coverage 100%.

### Phase 6.5 — UI/UX (reference: Logui video)

- Tree sidebar (contexts → namespaces → pods → containers) with status, favorites, bookmarked lines, shells and theme picker.
- Six themes: Dark (default), Midnight, Light, System, Solarized and High contrast.
- Lean top bar (search with counter and `Aa`/`.*`, Exclude, Presets, Time, Clear filters); level pills with "All"; icon actions; Following/Paused pill with auto-pause.
- Volume histogram per level with range filter (drag); single-line rows with a Details panel; export filtered lines.
- AI tab in the right panel: free question, follow-up questions, context by line/groups/visible lines, "AI estimate"; diff with line numbers and "Copy diff".
- Status bar with state, location, count and AI provider; shortcuts (`?`, `Esc`).
- Fix: the histogram and time filter use the kubectl clock (Laravel in UTC−3 stretched the axis).
- E2E: 16 scenarios, including details, histogram, themes, bookmarks, favorites and AI with follow-up.

### Phase 6.6 — Contexts and files

- Single context picker at the top of the sidebar (remembers the last one); "Manage contexts…" hides contexts in LogDeck and copies the `kubectl config delete-context` command for the user to run; `project/host:port/user` names are shortened.
- Search for a pod or namespace in the tree.
- "Copy for ticket" in the Details tab (pod, times in UTC, level and line, with secrets masked); copies go through the main process (`clipboard:copy-text`), which works without window focus.
- Thinner production banner (G5), with only "PRODUCTION".
- Open a log file (⌘O, button or drag onto the window), with a 200 MB limit and refusal of empty or binary files.
- Commits without the `Co-Authored-By` trailer (local history rewritten before the first push).

### Phase 6.7 — Preferences, themes and languages

- Preferences screen (theme, language, About) in the sidebar footer; the theme picker left the footer.
- Eight new themes: Dracula, Nord, Monokai, Gruvbox, One Dark, Tokyo Night, Catppuccin Mocha and GitHub light.
- UI in pt-BR, pt-PT, English and Spanish (dictionaries with the same keys and placeholders, checked by tests); native menu translated via `app:set-language`.
- Credits: "Made by Matheus Corteletti — Wise" in Preferences → About, in the macOS About panel and in `package.json`.
- "Following" became "Live"; "Terminal" button with text; duplicate "Go to end" icon removed and export with its own icon; "Connected" status.
- Rename contexts only in LogDeck (alias) and short names for EKS (`cluster (EKS · region)`, no account number) and GKE.
- Themes: Solarized, Gruvbox, Monokai, One Dark and GitHub light (too close to Light) are removed; Matrix (hacker style) is added. Anyone using a removed theme goes back to Dark.
- Fixes: "Manage contexts" opens over the whole window (portal) with name, alias and buttons visible; the Preferences "About" section shows one item per line.
- Lean macOS menu (LogDeck, Edit, Window), without View, Dictation and Emoji.
- About: GitHub and LinkedIn buttons (fixed URLs in the main process), clickable repository, author name only once, no "Inspired by Logui"; license and documents in Matheus Corteletti's name.
- Matrix theme removed. Export with a download icon; "Go to top" became pause/resume.
- App icon ("Deck" concept: stacked cards with log lines and the error line highlighted), with two more concepts in `build/icon-src/` (Lens and Pulse); `make icon` builds `build/icon.png` and `build/icon.icns` with macOS tools only (Quick Look, sips, iconutil). In `make dev`, the Dock shows the same icon.
- README without the "Inspired by Logui" line.
- Icon: transparent corners (Quick Look drew over white; `scripts/icon-mask.mjs` cuts the rounded square from Apple's grid) and Deck redesigned with a bigger card and lines.

### 1.0.0 release

- Version 1.0.0; `.dmg` and `.zip` packages for Apple Silicon (`npm run release:mac`), without Apple signing.
- README with installation, usage, shortcuts, AI, security and build from source.
- Fix (found by the first CI run on GitHub): the Presets and Time popovers close on outside click or Esc; before, they stayed open and covered the action bar in smaller windows.
