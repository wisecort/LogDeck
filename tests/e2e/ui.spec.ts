// End-to-end UI flow with the fake kubectl (SPEC §6) plus the phase 6.5 UI/UX features.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { fakeKubectlEnv } from '../helpers/fake-kubectl'
import { navTree, openPod, openWebPod, PRD } from '../helpers/ui'

let app: ElectronApplication
let win: Page

test.beforeEach(async () => {
  const fake = fakeKubectlEnv({ FAKE_KUBECTL_DELAY_MS: '0' })
  app = await electron.launch({
    args: ['.'],
    env: { ...(fake.env as Record<string, string>), LOGDECK_USER_DATA: mkdtempSync(join(tmpdir(), 'logdeck-e2e-')) },
  })
  win = await app.firstWindow()
})

test.afterEach(async () => {
  await app.close()
})

const rows = () => win.getByTestId('log-row')

test('main flow: live log, ERROR filter, FPM search and the F6 timeout group', async () => {
  await openWebPod(win)
  await win.screenshot({ path: 'test-results/ui-live.png' })

  const group = win.getByTestId('error-group').filter({ hasText: 'Timeout Apache → PHP-FPM' })
  await expect(group).toContainText('6×')
  await expect(win.getByTestId('error-group').filter({ hasText: 'Permissão no startup' })).toContainText('3×')

  await win.keyboard.press('Meta+f')
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
  await win.getByTestId('log-list').evaluate((el) => el.scrollTo(0, 0))
  await expect(rows().filter({ hasText: '×121' })).toContainText('checagem de disponibilidade')
  await win.getByRole('button', { name: 'Colapsar repetidas' }).click()
  await expect(rows().filter({ hasText: '×121' })).toHaveCount(0)
})

test('F5.4: a catastrophic regex is refused and the UI stays responsive', async () => {
  await openWebPod(win)
  await win.getByRole('button', { name: 'Expressão regular' }).click()
  await win.getByLabel('Buscar').fill('(a+)+$')
  await expect(win.getByText('Regex muito custosa')).toBeVisible()
  await win.getByLabel('Buscar').fill('AH0107[15]')
  await expect(rows().first()).toContainText(/AH0107[15]/)
})

test('G5: production contexts show a red banner', async () => {
  await openPod(win, { context: PRD, pod: /portal-worker/ })
  await expect(win.getByTestId('prod-banner')).toContainText('PRODUÇÃO')
  await expect(navTree(win)).toContainText('PROD')
})

test('F3.2: CrashLoopBackOff pod offers --previous', async () => {
  await openPod(win, { pod: /portal-worker/ })
  await expect(win.getByTestId('stream-status')).toContainText('Live')
  await win.getByRole('button', { name: /Tempo/ }).click()
  await win.getByLabel('--previous').check()
  await expect(win.getByTestId('stream-status')).toContainText('Encerrado')
  await expect(rows().filter({ hasText: 'FPM initialization failed' })).toHaveCount(1)
})

test('P5: Pod Shell runs in a real TTY (no job-control errors)', async () => {
  await openWebPod(win, 'php-fpm')
  await win.getByRole('button', { name: 'Abrir shell' }).click()
  const term = win.getByTestId('shell-term')
  await expect(term).toContainText('fake-shell tty=yes')
  await expect(term).not.toContainText('Inappropriate ioctl')
  await term.click()
  await win.keyboard.type('echo ok')
  await win.keyboard.press('Enter')
  await expect(term).toContainText('echo ok')
  await expect(navTree(win)).toContainText('Shells')
  await win.screenshot({ path: 'test-results/ui-shell.png' })
})

test('6.5: selecting a line pauses the view and shows its details', async () => {
  await openWebPod(win)
  await expect(win.getByTestId('follow-pill')).toContainText('Seguindo')
  await win.getByLabel('Buscar').fill('AH01075')
  await rows().first().click()
  await expect(win.getByTestId('follow-pill')).toContainText('Pausado')
  const details = win.getByTestId('log-details')
  await expect(details).toContainText('apache-error')
  await expect(details).toContainText('Horário kubectl')
  await expect(details).toContainText('proxy_fcgi')
  await win.screenshot({ path: 'test-results/ui-details.png' })
  await win.getByTestId('follow-pill').click()
  await expect(win.getByTestId('follow-pill')).toContainText('Seguindo')
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

test('6.5: themes, bookmarks and favourite namespaces', async () => {
  await openWebPod(win)
  for (const theme of ['claro', 'meia-noite', 'solarizado', 'alto-contraste', 'sistema', 'escuro']) {
    await win.getByLabel('Tema').selectOption(theme)
    await expect(win.locator('html')).toHaveAttribute('data-theme', theme)
  }
  await win.getByLabel('Tema').selectOption('meia-noite')
  await win.screenshot({ path: 'test-results/ui-theme-meia-noite.png' })

  const row = rows().last()
  await row.click()
  await row.getByRole('button', { name: 'Marcar linha' }).click()
  await expect(win.getByRole('list', { name: 'Linhas marcadas' }).getByRole('button')).toHaveCount(1)

  await win.getByRole('button', { name: 'Favoritar portal-hml' }).first().click()
  await expect(navTree(win)).toContainText('Favoritos')
})
