// End-to-end UI flow with the fake kubectl (SPEC §6) plus the phase 6.5 UI/UX features.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { fakeKubectlEnv } from '../helpers/fake-kubectl'
import { HML, navTree, openPod, openWebPod, PRD, selectContext } from '../helpers/ui'

let app: ElectronApplication
let win: Page
// Some tests copy to the real macOS clipboard: put the user's content back afterwards.
let savedClipboard = ''

test.beforeEach(async () => {
  const fake = fakeKubectlEnv({ FAKE_KUBECTL_DELAY_MS: '0' })
  app = await electron.launch({
    args: ['.', '--lang=pt-BR'],
    env: { ...(fake.env as Record<string, string>), LOGDECK_USER_DATA: mkdtempSync(join(tmpdir(), 'logdeck-e2e-')) },
  })
  win = await app.firstWindow()
  savedClipboard = await app.evaluate(({ clipboard }) => clipboard.readText())
})

test.afterEach(async () => {
  await app.evaluate(({ clipboard }, text) => clipboard.writeText(text), savedClipboard)
  await app.close()
})

const rows = () => win.getByTestId('log-row')

test('main flow: live log, ERROR filter, FPM search and the F6 timeout group', async () => {
  await openWebPod(win)
  await win.screenshot({ path: 'test-results/ui-live.png' })

  const group = win.getByTestId('error-group').filter({ hasText: 'Timeout Apache → PHP-FPM' })
  await expect(group).toContainText('6×')
  await expect(win.getByTestId('error-group').filter({ hasText: 'Permissão no startup' })).toContainText('3×')

  await win.keyboard.press('ControlOrMeta+f')
  await expect(win.getByLabel('Buscar')).toBeFocused()
  await win.keyboard.type('FPM')
  await expect(rows().first()).toBeVisible()
  for (const text of await rows().allInnerTexts()) expect(text.toLowerCase()).toContain('fpm')
  await expect(win.locator('mark').first()).toBeVisible()

  await win.getByLabel('Buscar').fill('')
  await win.getByRole('group', { name: 'Níveis' }).getByRole('button', { name: /^ERROR/ }).click({ modifiers: ['Alt'] })
  await expect(rows().first()).toBeVisible()
  for (const level of await rows().evaluateAll((els) => els.map((e) => e.getAttribute('data-level')))) expect(level).toBe('ERROR')

  await group.getByRole('button').click()
  await expect(rows()).toHaveCount(6)
  await win.getByRole('button', { name: 'Limpar filtros' }).click()
  await expect(win.getByTestId('match-count')).toContainText('/ 465')
})

test('P3: health checks hidden by the default preset, collapsed ×121 when shown', async () => {
  await openWebPod(win)
  await expect(rows().filter({ hasText: 'checagem de disponibilidade' })).toHaveCount(0)
  await win.getByRole('button', { name: /Presets/ }).click()
  await win.getByRole('group', { name: 'Presets de exclusão' }).getByRole('button', { name: 'Ocultar health checks' }).click()
  await win.keyboard.press('Escape')
  await expect(win.getByRole('group', { name: 'Presets de exclusão' })).toHaveCount(0)
  // Follow mode may scroll back to the bottom right after the filter re-renders: retry the scroll.
  await expect(async () => {
    await win.getByTestId('log-list').evaluate((el) => el.scrollTo(0, 0))
    await expect(rows().filter({ hasText: '×121' })).toContainText('checagem de disponibilidade', { timeout: 500 })
  }).toPass()
  await win.getByRole('button', { name: 'Colapsar repetidas' }).click()
  await expect(rows().filter({ hasText: '×121' })).toHaveCount(0)
})

test('popovers close on outside click and Escape, so they never cover the toolbar', async () => {
  await openWebPod(win)
  await win.getByRole('button', { name: /Presets/ }).click()
  await expect(win.getByRole('group', { name: 'Presets de exclusão' })).toBeVisible()
  await win.getByTestId('log-list').click({ position: { x: 5, y: 5 } })
  await expect(win.getByRole('group', { name: 'Presets de exclusão' })).toHaveCount(0)

  await win.getByRole('button', { name: 'Tempo' }).click()
  await expect(win.getByLabel('tail')).toBeVisible()
  await win.keyboard.press('Escape')
  await expect(win.getByLabel('tail')).toHaveCount(0)
})

test('recent pods: the last ones opened reopen with the same container', async () => {
  await openPod(win, { pod: /portal-web/, container: 'php-fpm' })
  await expect(win.getByTestId('stream-status')).toContainText('Conectado')
  // the namespace is already open: click the second pod directly
  await navTree(win).getByRole('list', { name: 'Namespaces' }).getByRole('button', { name: /portal-worker/ }).click()
  const recents = navTree(win).getByRole('list', { name: 'Recentes' })
  await expect(recents.locator('li')).toHaveCount(2)
  await expect(recents.getByRole('button').first()).toContainText('portal-worker')
  await recents.getByRole('button', { name: /^portal-web/ }).click()
  await expect(win.locator('.statusbar')).toContainText('portal-web-7d9f8c6b5-x2k4p › php-fpm')
  await expect(recents.getByRole('button').first()).toContainText('portal-web')
  // the × (shown on hover) forgets an entry, and it stays forgotten after a reload
  await recents.locator('li').filter({ hasText: 'portal-worker' }).hover()
  await recents.getByRole('button', { name: /Tirar portal-worker.* dos recentes/ }).click()
  await expect(recents.getByRole('button', { name: /^portal-worker/ })).toHaveCount(0)
  await win.reload()
  await expect(navTree(win).getByRole('list', { name: 'Recentes' }).getByRole('button', { name: /^portal-worker/ })).toHaveCount(0)
})

test('tabs: two pods stream side by side, switch, close, and Home keeps them running', async () => {
  await openWebPod(win)
  const tabs = win.getByTestId('log-tab')
  const tabList = win.getByRole('tablist', { name: 'Abas' })
  await expect(tabs).toHaveCount(1)
  await expect(tabs.first()).toContainText('portal-web-7d9f8c6b5-x2k4p / httpd')

  // ⌘/Ctrl-click opens the worker pod in a new tab, the web tab keeps its 465 lines
  await navTree(win).getByRole('list', { name: 'Namespaces' }).getByRole('button', { name: /portal-worker/ }).click({ modifiers: ['ControlOrMeta'] })
  await expect(tabs).toHaveCount(2)
  await expect(tabList.getByRole('tab', { selected: true })).toContainText('portal-worker')
  await expect(win.getByTestId('match-count')).not.toContainText('/ 465')

  await tabList.getByRole('tab', { name: /portal-web/ }).click()
  await expect(win.getByTestId('match-count')).toContainText('/ 465')
  await expect(win.locator('.statusbar')).toContainText('portal-web-7d9f8c6b5-x2k4p › httpd')

  await win.getByRole('button', { name: /Fechar aba portal-worker/ }).click()
  await expect(tabs).toHaveCount(1)

  // Home is the house button, not a tab: the pod tab stays open and keeps its log
  await expect(win.getByRole('button', { name: 'Nova aba', exact: true })).toHaveCount(0)
  await win.getByRole('button', { name: 'Início', exact: true }).click()
  await expect(win.getByTestId('welcome')).toBeVisible()
  await expect(tabs).toHaveCount(1)
  await expect(tabList.getByRole('tab', { selected: true })).toHaveCount(0)
  await tabList.getByRole('tab', { name: /portal-web/ }).click()
  await expect(win.getByTestId('match-count')).toContainText('/ 465')
})

test('compare with --previous: current and previous container side by side', async () => {
  await openPod(win, { pod: /portal-worker/ })
  await expect(win.getByTestId('stream-status')).toContainText('Conectado')
  const compare = win.getByRole('button', { name: 'Comparar com o anterior' })
  await expect(compare).toBeEnabled()
  await compare.click()
  const previous = win.getByTestId('previous-pane')
  await expect(previous).toContainText('Container anterior (--previous)')
  await expect(previous.getByTestId('log-row').filter({ hasText: 'FPM initialization failed' })).toHaveCount(1)
  await expect(previous.getByRole('button', { name: 'Marcar linha' })).toHaveCount(0)
  await win.screenshot({ path: 'test-results/ui-compare.png' })

  // level filters apply to both panes
  await win.getByRole('group', { name: 'Níveis' }).getByRole('button', { name: /^ERROR/ }).click({ modifiers: ['Alt'] })
  for (const level of await previous.getByTestId('log-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-level')))) expect(level).toBe('ERROR')

  await compare.click()
  await expect(previous).toHaveCount(0)
  // a pod without restarts has no previous container
  const tree = navTree(win).getByRole('list', { name: 'Namespaces' })
  await tree.getByRole('button', { name: /portal-migrate/ }).click()
  await expect(win.locator('.statusbar')).toContainText('portal-migrate')
  await expect(win.getByRole('button', { name: 'Comparar com o anterior' })).toBeDisabled()
})

test('Pod tab: container state, uptime, previous run, limits and probes', async () => {
  await openWebPod(win, 'httpd')
  await expect(win.getByTestId('uptime')).toContainText('No ar há')
  await win.getByRole('tab', { name: 'Pod' }).click()
  const pod = win.getByTestId('pod-tab')
  await expect(win.getByTestId('pod-state')).toContainText('Rodando há')
  await expect(pod).toContainText('registry.example.internal/portal-httpd:2.4.62')
  await expect(pod).toContainText('req 64Mi · lim 128Mi')
  await expect(pod).toContainText('GET :8080/health a cada 10s')
  await expect(pod).toContainText('node-a.example.internal')

  // Access: Service selecting the pod (labels) → OKD Route and Ingress URLs, copied (never opened by the app)
  const access = win.getByTestId('pod-access')
  await expect(access).toContainText('https://portal-hml.apps.example.internal/')
  await expect(access).toContainText('https://portal.example.internal/')
  await expect(access).toContainText('ClusterIP · 80→8080 (http)')
  await expect(access).not.toContainText('portal-worker')
  await access.getByRole('button', { name: 'Copiar https://portal-hml.apps.example.internal/' }).click()
  await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toBe('https://portal-hml.apps.example.internal/')

  // php-fpm was OOMKilled once: the previous run shows why and for how long it ran
  await navTree(win).getByRole('group', { name: 'Containers' }).getByRole('button', { name: 'php-fpm', exact: true }).click()
  await expect(pod).toContainText('Container php-fpm')
  await expect(pod).toContainText('OOMKilled · exit 137 · rodou 6m 03s')
  await expect(win.getByTestId('uptime')).toContainText('↻1')
  await win.screenshot({ path: 'test-results/ui-pod.png' })
})

test('marks: a container restart and the pod events show between the lines and on the histogram', async () => {
  await openWebPod(win, 'php-fpm')
  // few rows, so the stretch around the restart is on screen (marks stay with level filters)
  await win.getByRole('group', { name: 'Níveis' }).getByRole('button', { name: /^ERROR/ }).click({ modifiers: ['Alt'] })
  const restart = win.getByTestId('log-mark').filter({ hasText: 'Container php-fpm reiniciado' })
  await expect(restart).toContainText('OOMKilled · exit 137 · rodou 6m 03s')
  // Kubernetes events of the pod (kubectl get events): the failing probe before it, the kill after
  await expect(win.getByTestId('log-mark').filter({ hasText: 'Evento: Unhealthy' })).toContainText('3× de')
  await expect(win.getByTestId('log-mark').filter({ hasText: 'Evento: Killing' })).toContainText('failed liveness probe')
  await expect(win.getByTestId('log-mark').filter({ hasText: 'Pulled' })).toHaveCount(0)
  await expect(win.getByTestId('volume-mark')).toHaveCount(3)
  await win.screenshot({ path: 'test-results/ui-marks.png' })
  // searching hides the marks: they describe the whole log, not the matches
  await win.getByLabel('Buscar').fill('FPM')
  await expect(win.getByTestId('log-mark')).toHaveCount(0)
  await win.getByLabel('Buscar').fill('')
  await restart.getByRole('button', { name: 'Ver logs anteriores' }).click()
  await expect(win.getByTestId('previous-pane')).toBeVisible()
})

test('marks: a dropped kubectl stream says when it was lost and when it came back', async () => {
  await app.close()
  const fake = fakeKubectlEnv({ FAKE_KUBECTL_DELAY_MS: '0', FAKE_KUBECTL_MODE: 'drop-after:200' })
  app = await electron.launch({
    args: ['.', '--lang=pt-BR'],
    env: { ...(fake.env as Record<string, string>), LOGDECK_USER_DATA: mkdtempSync(join(tmpdir(), 'logdeck-e2e-')) },
  })
  win = await app.firstWindow()
  await openPod(win, { pod: /portal-web/, container: 'httpd' })
  await expect(win.getByTestId('match-count')).toContainText('/ 465', { timeout: 15_000 })
  await win.getByRole('group', { name: 'Níveis' }).getByRole('button', { name: /^ERROR/ }).click({ modifiers: ['Alt'] })
  const drops = win.getByTestId('log-mark').filter({ hasText: 'Conexão perdida às' })
  await expect(drops.first()).toContainText('de volta às')
  await expect(drops.first()).toContainText('sem duplicar')
})

test('empty view explains lines hidden by filters and presets, with a way out', async () => {
  await openWebPod(win)
  // only FATAL, which this log has none of: every loaded line is filtered out
  await win.getByRole('group', { name: 'Níveis' }).getByRole('button', { name: /^FATAL/ }).click({ modifiers: ['Alt'] })
  const hidden = win.getByTestId('log-hidden')
  await expect(hidden).toContainText('465 linhas carregadas, mas nenhuma passa pelos filtros.')
  await expect(hidden).toContainText('174 delas são escondidas pelos presets')
  await hidden.getByRole('button', { name: 'Limpar filtros' }).click()
  await expect(rows().first()).toBeVisible()
})

test('OKD builds folder: Build history after the pods; log while the pod exists, details after', async () => {
  const tree = navTree(win).getByRole('list', { name: 'Namespaces' })
  await tree.getByRole('button', { name: 'portal-hml', exact: true }).click()
  await expect(tree.getByRole('button', { name: /portal-worker/ })).toBeVisible()
  await expect(tree.getByRole('button', { name: /portal-web-12/ })).toHaveCount(0)
  // with builds, the namespace has two folders: Pods (open) and Builds e deploys (closed)
  await expect(tree.getByRole('button', { name: /^Pods/ })).toHaveAttribute('aria-expanded', 'true')
  await expect(tree.getByRole('list', { name: 'Pods' }).getByRole('button', { name: /portal-worker/ })).toBeVisible()
  await expect(tree.getByRole('button', { name: /Builds e deploys/ })).toHaveAttribute('aria-expanded', 'false')

  // 2 Build objects + 1 deployer pod (the build pod of portal-web-12 is represented by its Build)
  const folder = tree.getByRole('button', { name: /Builds e deploys/ })
  await expect(folder).toContainText('3')
  await folder.click()
  const builds = tree.getByRole('list', { name: 'Builds e deploys' })
  await expect(builds.getByRole('button')).toHaveCount(3)
  await expect(builds.getByRole('button', { name: /portal-web-12/ })).toContainText('Complete')
  await expect(builds.getByRole('button', { name: /portal-web-11/ })).toContainText('Failed')
  // a build whose pod was pruned shows its details instead of a log
  await builds.getByRole('button', { name: /portal-web-11/ }).click()
  const details = win.getByTestId('build-details')
  await expect(details).toContainText('Failed — BuildPodEvicted')
  await expect(details).toContainText('e890735')
  await expect(details).toContainText('Log não disponível')
  await win.screenshot({ path: 'test-results/build-details.png' })
  await details.getByRole('button', { name: /Copiar/ }).click()
  expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe('oc describe build/portal-web-11 -n portal-hml')
  await expect(win.getByRole('tablist', { name: 'Abas' }).getByRole('tab', { selected: true })).toContainText('portal-web-11')
  await expect(builds.getByRole('button', { name: /portal-web-3-deploy/ })).toContainText('deploy')

  // the build whose pod still exists opens its main container (not the git-clone init step)
  await builds.getByRole('button', { name: /portal-web-12/ }).click()
  await expect(win.locator('.statusbar')).toContainText('portal-web-12-build › sti-build')
  // only the build container: no init steps (git-clone…) listed under the build
  await expect(builds.getByRole('group', { name: 'Containers' })).toHaveCount(0)
  // a finished build is read once, without reconnecting
  await expect(win.getByTestId('stream-status')).toContainText('Encerrado')
  // build lines are recognized (STEP/push as INFO, layers as DEBUG, errors as ERROR), RUN output is INFO
  await expect(win.getByRole('group', { name: 'Níveis' }).getByRole('button', { name: /^UNKNOWN/ })).toContainText('0')
  await expect(win.getByTestId('error-group').filter({ hasText: 'Falha no build' })).toContainText('2×')
  await win.screenshot({ path: 'test-results/build-log.png' })

  await win.reload()
  const tree2 = navTree(win).getByRole('list', { name: 'Namespaces' })
  await tree2.getByRole('button', { name: 'portal-hml', exact: true }).click()
  await expect(tree2.getByRole('list', { name: 'Builds e deploys' })).toBeVisible()
})

test('welcome screen on empty tabs and the Home button brings it back', async () => {
  const home = win.getByRole('button', { name: 'Início', exact: true })
  await expect(win.getByTestId('welcome')).toBeVisible()
  // The app opens on the home screen: the Home button is lit and there is no tab yet.
  await expect(home).toHaveAttribute('aria-pressed', 'true')
  await expect(win.getByTestId('log-tab')).toHaveCount(0)
  await expect(win.getByRole('tab', { name: 'Erros (0)' })).toHaveCount(0)
  await openWebPod(win)
  await expect(win.getByTestId('welcome')).toHaveCount(0)
  await expect(home).toHaveAttribute('aria-pressed', 'false')
  await home.click()
  await expect(win.getByTestId('welcome')).toBeVisible()
  await expect(home).toHaveAttribute('aria-pressed', 'true')
  await expect(win.getByTestId('stream-status')).toContainText('Sem log aberto')
  // the last pod card reopens it
  await win.getByTestId('welcome').getByRole('button', { name: /Último pod/ }).click()
  await expect(win.getByTestId('match-count')).toContainText('/ 465')
})

test('F5.4: a catastrophic regex is refused and the UI stays responsive', async () => {
  await openWebPod(win)
  await win.getByRole('button', { name: 'Expressão regular' }).click()
  await win.getByLabel('Buscar').fill('(a+)+$')
  await expect(win.getByText('Regex muito custosa')).toBeVisible()
  await win.getByLabel('Buscar').fill('AH0107[15]')
  await expect(rows().first()).toContainText(/AH0107[15]/)
})

test('context picker: current context first, switching and hiding never touch the kubeconfig', async () => {
  const picker = win.getByLabel('Contexto', { exact: true })
  await expect(picker).toHaveValue(HML)
  await expect(navTree(win).getByRole('button', { name: 'portal-hml', exact: true })).toBeVisible()

  await selectContext(win, PRD)
  await expect(win.locator('.ctx-picker')).toContainText('PROD')
  await win.reload()
  await expect(win.getByLabel('Contexto', { exact: true })).toHaveValue(PRD)

  await win.getByLabel('Contexto', { exact: true }).selectOption({ label: 'Gerenciar contextos…' })
  const dialog = win.getByRole('dialog', { name: 'Gerenciar contextos' })
  await dialog.getByLabel(`Nome no LogDeck para ${HML}`).fill('homologacao')
  await dialog.getByLabel(`Nome no LogDeck para ${HML}`).press('Enter')
  await dialog.getByRole('button', { name: `Ocultar ${PRD}` }).click()
  await dialog.getByRole('button', { name: `Copiar comando para remover ${PRD}` }).click()
  expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe(`kubectl config delete-context '${PRD}'`)
  await dialog.getByRole('button', { name: 'Fechar' }).click()
  await expect(win.getByLabel('Contexto', { exact: true })).toHaveValue(HML)
  await expect(win.getByLabel('Contexto', { exact: true }).locator('option', { hasText: 'portal-prd' })).toHaveCount(0)
  await expect(win.getByLabel('Contexto', { exact: true }).locator('option:checked')).toHaveText(/^homologacao/)
  await openPod(win, { pod: /portal-worker/ })
  await expect(win.getByTestId('stream-status').locator('..')).toContainText('homologacao › portal-hml')
  await expect(win.locator('.statusbar')).not.toContainText(HML)
})

test('pod search filters the tree and opens matching namespaces', async () => {
  await navTree(win).getByRole('button', { name: 'portal-hml', exact: true }).click()
  await expect(navTree(win).getByRole('button', { name: /portal-worker/ })).toBeVisible()
  await navTree(win).getByRole('button', { name: 'portal-hml', exact: true }).click()
  await win.getByLabel('Procurar pod ou namespace').fill('web')
  await expect(navTree(win).getByRole('button', { name: /portal-web/ })).toBeVisible()
  await expect(navTree(win).getByRole('button', { name: /portal-worker/ })).toHaveCount(0)
})

test('copy with details: pod, UTC times, level and the line', async () => {
  await openWebPod(win)
  await win.getByLabel('Buscar').fill('AH01075')
  await win.getByTestId('log-row').first().click()
  await win.getByRole('button', { name: 'Copiar com detalhes' }).click()
  const text = await app.evaluate(({ clipboard }) => clipboard.readText())
  expect(text).toContain('Pod: portal-hml / portal-web-7d9f8c6b5-x2k4p / httpd')
  expect(text).toMatch(/Horário \(kubectl\): 2026-10-09 \d\d:\d\d:\d\d\.\d{3} UTC/)
  expect(text).toContain('AH01075')
  // the button says "Copiado" for a moment, then goes back
  await expect(win.getByRole('button', { name: 'Copiado' })).toBeVisible()
  await expect(win.getByRole('button', { name: 'Copiar com detalhes' })).toBeVisible({ timeout: 5000 })

  // "Mascarar dados sensíveis" also hides the context (cluster host and user) and internal IPs
  await win.getByTestId('log-details').getByLabel('Mascarar dados sensíveis').check()
  await win.getByRole('button', { name: 'Copiar com detalhes' }).click()
  const masked = await app.evaluate(({ clipboard }) => clipboard.readText())
  expect(masked).toContain('[REDACTED:CONTEXT]')
  expect(masked).not.toContain('api-hml-example-internal')
  expect(masked).toContain('[client [REDACTED:IP]:')
})

test('copy the line from Details, with or without masking secrets and internal IPs', async () => {
  await openWebPod(win)
  await win.getByLabel('Buscar').fill('AH01075')
  await win.getByTestId('log-row').first().click()
  const details = win.getByTestId('log-details')
  await details.getByRole('button', { name: 'Copiar', exact: true }).click()
  await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toContain('[client 10.0.0.2:')

  await details.getByLabel('Mascarar dados sensíveis').check()
  await details.getByRole('button', { name: 'Copiar', exact: true }).click()
  await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toContain('[client [REDACTED:IP]:')
  expect(await app.evaluate(({ clipboard }) => clipboard.readText())).not.toContain('10.0.0.2')
})

test('opens a saved log file and refuses binary ones', async () => {
  await win.getByLabel('Arquivo de log').setInputFiles('tests/fixtures/pod-php-apache.log')
  await expect(win.getByTestId('stream-status')).toContainText('Arquivo')
  await expect(win.getByTestId('match-count')).toContainText('/ 465')
  await expect(navTree(win)).toContainText('pod-php-apache.log')
  await expect(win.getByTestId('error-group').filter({ hasText: 'Timeout Apache → PHP-FPM' })).toContainText('6×')

  await win.getByLabel('Arquivo de log').setInputFiles({ name: 'x.gz', mimeType: 'application/gzip', buffer: Buffer.from([0x1f, 0x8b, 0, 0]) })
  const dialog = win.getByRole('alertdialog')
  await expect(dialog).toContainText('Não parece um arquivo de texto')
  await expect(dialog).toContainText('x.gz')
  await dialog.getByRole('button', { name: 'OK' }).click()
  await expect(dialog).toHaveCount(0)
})

test('issue #24: an empty log file opens a centered dialog that needs a click (or Esc)', async () => {
  await win.getByLabel('Arquivo de log').setInputFiles({ name: 'vazio.log', mimeType: 'text/plain', buffer: Buffer.alloc(0) })
  const dialog = win.getByRole('alertdialog')
  await expect(dialog).toContainText('O arquivo está vazio')
  await expect(dialog).toContainText('vazio.log')
  await expect(dialog.getByRole('button', { name: 'Abrir outro arquivo…' })).toBeFocused()
  await win.screenshot({ path: 'test-results/ui-file-error.png', animations: 'disabled' })
  await expect(win.locator('.notice')).toHaveCount(0)
  await win.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('G5: production contexts are flagged PROD in the picker and the status bar (no banner)', async () => {
  await openPod(win, { context: PRD, pod: /portal-worker/ })
  await expect(win.getByTestId('prod-badge')).toHaveText('PROD')
  await expect(win.locator('.ctx-picker')).toContainText('PROD')
  await expect(win.getByTestId('prod-banner')).toHaveCount(0)
})

test('F3.2: CrashLoopBackOff pod offers --previous', async () => {
  await openPod(win, { pod: /portal-worker/ })
  await expect(win.getByTestId('stream-status')).toContainText('Conectado')
  await win.getByRole('button', { name: /Tempo/ }).click()
  await win.getByLabel('--previous').check()
  await expect(win.getByTestId('stream-status')).toContainText('Encerrado')
  await expect(rows().filter({ hasText: 'FPM initialization failed' })).toHaveCount(1)
})

test('P5: Pod Shell runs in a real TTY (no job-control errors)', async () => {
  await openWebPod(win, 'php-fpm')
  await win.getByRole('button', { name: 'Abrir terminal' }).click()
  const term = win.getByTestId('shell-term')
  await expect(term).toContainText('fake-shell tty=yes')
  await expect(term).not.toContainText('Inappropriate ioctl')
  await term.click()
  await win.keyboard.type('echo ok')
  await win.keyboard.press('Enter')
  await expect(term).toContainText('echo ok')
  await expect(navTree(win)).toContainText('Terminais')
  await win.screenshot({ path: 'test-results/ui-shell.png' })
})

test('6.5: selecting a line pauses the view and shows its details', async () => {
  await openWebPod(win)
  await expect(win.getByTestId('follow-pill')).toContainText('Ao vivo')
  await win.getByLabel('Buscar').fill('AH01075')
  await rows().first().click()
  await expect(win.getByTestId('follow-pill')).toContainText('Pausado')
  const details = win.getByTestId('log-details')
  await expect(details).toContainText('apache-error')
  await expect(details).toContainText('Horário kubectl')
  await expect(details).toContainText('proxy_fcgi')
  await win.screenshot({ path: 'test-results/ui-details.png' })
  await win.getByTestId('follow-pill').click()
  await expect(win.getByTestId('follow-pill')).toContainText('Ao vivo')
})

test('6.5: dragging on the volume chart filters a time range', async () => {
  await openWebPod(win)
  const bars = win.getByTestId('volume').locator('.volume-bars')
  const box = (await bars.boundingBox())!
  await win.mouse.move(box.x + box.width * 0.55, box.y + box.height / 2)
  await win.mouse.down()
  await win.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, { steps: 5 })
  await win.mouse.up()
  await expect(win.getByRole('button', { name: 'Limpar intervalo' })).toBeVisible()
  const shown = Number((await win.getByTestId('match-count').innerText()).split('/')[0]!.trim())
  expect(shown).toBeLessThan(291)
  await win.getByRole('button', { name: 'Limpar intervalo' }).click()
  await expect(win.getByTestId('match-count')).toContainText('291 / 465')
})

test('Windows/Linux have no menu bar at all', async () => {
  test.skip(process.platform === 'darwin', 'macOS keeps the slim app menu')
  expect(await app.evaluate(({ Menu }) => Menu.getApplicationMenu())).toBeNull()
})

test('native menu only has what LogDeck uses (no View, Dictation or Emoji items)', async () => {
  test.skip(process.platform !== 'darwin', 'Windows/Linux run without a menu bar')
  const menu = await app.evaluate(({ Menu }) =>
    Menu.getApplicationMenu()!.items.map((i) => [i.label, i.submenu?.items.filter((s) => s.type !== 'separator').map((s) => s.label) ?? []]),
  )
  expect(menu.map(([label]) => label)).toEqual(['LogDeck', 'Editar', 'Janela'])
  expect(menu[1]![1]).toEqual(['Desfazer', 'Refazer', 'Recortar', 'Copiar', 'Colar', 'Selecionar tudo'])
  expect(await app.evaluate(({ systemPreferences }) => systemPreferences.getUserDefault('NSDisabledDictationMenuItem', 'boolean'))).toBe(true)
})

test('language: English, Spanish and pt-PT translate the interface and persist', async () => {
  await openWebPod(win)
  await win.getByRole('button', { name: 'Preferências', exact: true }).click()
  await win.getByRole('dialog', { name: 'Preferências', exact: true }).getByRole('radio', { name: 'English' }).click()
  await expect(win.locator('html')).toHaveAttribute('lang', 'en')
  await win.getByRole('dialog', { name: 'Preferences', exact: true }).getByRole('button', { name: 'Close' }).click()
  await expect(win.getByLabel('Search', { exact: true })).toBeVisible()
  await expect(win.getByTestId('follow-pill')).toContainText('Live')
  await expect(win.getByTestId('match-count')).toContainText('lines')
  await expect(win.getByTestId('error-group').first()).toContainText('Apache → PHP-FPM timeout')
  await win.screenshot({ path: 'test-results/ui-english.png' })

  await win.reload()
  await expect(win.getByRole('button', { name: 'Preferences', exact: true })).toBeVisible()
  await win.getByRole('button', { name: 'Preferences', exact: true }).click()
  await win.getByRole('dialog', { name: 'Preferences', exact: true }).getByRole('radio', { name: 'Español' }).click()
  await expect(win.getByRole('dialog', { name: 'Preferencias', exact: true })).toContainText('Hecho por')
  await win.getByRole('dialog', { name: 'Preferencias', exact: true }).getByRole('radio', { name: 'Português (Portugal)' }).click()
  await expect(win.getByRole('button', { name: 'Definições', exact: true })).toBeVisible()
})

test('Preferences: in the default 1280×800 window the About card shows without scrolling', async () => {
  await win.getByRole('button', { name: 'Preferências', exact: true }).click()
  const prefs = win.getByRole('dialog', { name: 'Preferências', exact: true })
  await expect(prefs.getByTestId('about')).toBeInViewport({ ratio: 1 })
  await expect(prefs.getByRole('radio', { name: 'Catppuccin Mocha' })).toBeInViewport({ ratio: 1 })
})

test('6.5: themes, bookmarks and favourite namespaces', async () => {
  await openWebPod(win)
  await win.getByRole('button', { name: 'Preferências', exact: true }).click()
  const prefs = win.getByRole('dialog', { name: 'Preferências', exact: true })
  const themes: Array<[string, string]> = [['claro', 'Claro'], ['meia-noite', 'Meia-noite'], ['dracula', 'Dracula'], ['nord', 'Nord'], ['tokyo-night', 'Tokyo Night'], ['alto-contraste', 'Alto contraste'], ['sistema', 'Sistema (macOS)'], ['escuro', 'Escuro']]
  for (const [id, name] of themes) {
    await prefs.getByRole('radiogroup', { name: 'Tema' }).getByRole('radio', { name }).click()
    await expect(win.locator('html')).toHaveAttribute('data-theme', id)
  }
  await prefs.getByRole('radio', { name: 'Dracula' }).click()
  await expect(prefs.getByTestId('about')).toContainText('Feito por Matheus Corteletti — Wise')
  await expect(prefs.getByTestId('about')).not.toContainText('Logui')
  await win.screenshot({ path: 'test-results/ui-prefs.png' })
  // Never open a real browser in tests: capture what main would open.
  await app.evaluate(({ shell }) => {
    ;(globalThis as { opened?: string[] }).opened = []
    shell.openExternal = async (url: string) => {
      ;(globalThis as { opened?: string[] }).opened!.push(url)
    }
  })
  await prefs.getByRole('button', { name: 'Abrir o LinkedIn do autor' }).click()
  await prefs.getByRole('button', { name: 'Abrir o GitHub do LogDeck' }).click()
  await expect
    .poll(() => app.evaluate(() => (globalThis as { opened?: string[] }).opened))
    .toEqual(['https://www.linkedin.com/in/cortelettimatheus/', 'https://github.com/wisecort/LogDeck'])
  expect(await win.evaluate(() => window.logdeck.openLink('https://evil.example' as 'github').then(() => 'opened', (e: Error) => e.message))).toContain('link inválido')
  await prefs.getByRole('button', { name: 'Fechar' }).click()
  await win.screenshot({ path: 'test-results/ui-theme-dracula.png' })

  const row = rows().last()
  await row.click()
  await row.getByRole('button', { name: 'Marcar linha' }).click()
  await expect(win.getByRole('list', { name: 'Linhas marcadas' }).getByRole('button')).toHaveCount(1)

  await win.getByRole('button', { name: 'Favoritar portal-hml' }).first().click()
  await expect(navTree(win)).toContainText('Favoritos')
})
