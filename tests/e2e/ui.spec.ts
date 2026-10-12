// End-to-end UI flow with the fake kubectl (SPEC §6): context → namespace → pod → live log →
// filter ERROR → search FPM → F6 shows "Timeout Apache → PHP-FPM"; plus P3, P5, G5 and --previous.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { fakeKubectlEnv } from '../helpers/fake-kubectl'

const HML = 'portal-hml/api-hml-example-internal:6443/dev'
const PRD = 'portal-prd/api-prd-example-internal:6443/dev'
const WEB = 'portal-web-7d9f8c6b5-x2k4p'

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

async function openWebPod(container = 'httpd') {
  await win.getByLabel('Contexto').selectOption(HML)
  await win.getByLabel('Namespace').selectOption('portal-hml')
  await win.getByRole('button', { name: new RegExp(WEB) }).click()
  await win.getByRole('group', { name: 'Containers' }).getByRole('button', { name: container, exact: true }).click()
  await expect(win.getByTestId('stream-status')).toContainText('Live')
  await expect(win.getByTestId('match-count')).toContainText('/ 465')
}

const rows = () => win.getByTestId('log-row')

test('main flow: live log, ERROR filter, FPM search and the F6 timeout group', async () => {
  await openWebPod()
  await win.screenshot({ path: 'test-results/ui-live.png' })

  // F6: timeout group from P4.
  const group = win.getByTestId('error-group').filter({ hasText: 'Timeout Apache → PHP-FPM' })
  await expect(group).toContainText('6×')
  await expect(win.getByTestId('error-group').filter({ hasText: 'Permissão no startup' })).toContainText('3×')

  // F5: ⌘F focuses the search; FPM matches are highlighted.
  await win.keyboard.press('Meta+f')
  await expect(win.getByLabel('Buscar')).toBeFocused()
  await win.keyboard.type('FPM')
  await expect(rows().first()).toBeVisible()
  for (const text of await rows().allInnerTexts()) expect(text.toLowerCase()).toContain('fpm')
  await expect(win.locator('mark').first()).toBeVisible()

  // F4: ⌥+click shows only ERROR.
  await win.getByLabel('Buscar').fill('')
  await win.getByRole('group', { name: 'Níveis' }).getByRole('button', { name: /^ERROR/ }).click({ modifiers: ['Alt'] })
  await expect(rows().first()).toBeVisible()
  for (const level of await rows().evaluateAll((els) => els.map((e) => e.getAttribute('data-level')))) expect(level).toBe('ERROR')

  // F6.4: clicking a group filters the list to it.
  await group.getByRole('button').click()
  await expect(rows()).toHaveCount(6)
  await win.screenshot({ path: 'test-results/ui-group.png' })
})

test('P3: health checks hidden by the default preset, collapsed ×121 when shown', async () => {
  await openWebPod()
  await expect(rows().filter({ hasText: 'checagem de disponibilidade' })).toHaveCount(0)
  await win.getByRole('group', { name: 'Presets de exclusão' }).getByRole('button', { name: 'Ocultar health checks' }).click()
  // The list follows the tail; the ×121 run is near the top.
  await win.getByTestId('log-list').evaluate((el) => el.scrollTo(0, 0))
  await expect(rows().filter({ hasText: '×121' })).toContainText('checagem de disponibilidade')
  await win.getByLabel('Colapsar repetidas').uncheck()
  await expect(rows().filter({ hasText: '×121' })).toHaveCount(0)
})

test('F5.4: a catastrophic regex is refused and the UI stays responsive', async () => {
  await openWebPod()
  await win.getByLabel('Expressão regular').check()
  await win.getByLabel('Buscar').fill('(a+)+$')
  await expect(win.getByText('Regex muito custosa')).toBeVisible()
  await win.getByLabel('Buscar').fill('AH0107[15]')
  await expect(rows().first()).toContainText(/AH0107[15]/)
})

test('G5: production contexts show a red banner', async () => {
  await win.getByLabel('Contexto').selectOption(PRD)
  await expect(win.getByTestId('prod-banner')).toContainText('PRODUÇÃO')
  await win.getByLabel('Contexto').selectOption(HML)
  await expect(win.getByTestId('prod-banner')).toHaveCount(0)
})

test('F3.2: CrashLoopBackOff pod offers --previous', async () => {
  await win.getByLabel('Contexto').selectOption(HML)
  await win.getByLabel('Namespace').selectOption('portal-hml')
  await win.getByRole('button', { name: /portal-worker/ }).click()
  await expect(win.getByTestId('stream-status')).toContainText('Live')
  await win.getByLabel('--previous').check()
  await expect(win.getByTestId('stream-status')).toContainText('Encerrado')
  await expect(rows().filter({ hasText: 'FPM initialization failed' })).toHaveCount(1)
})

test('P5: Pod Shell runs in a real TTY (no job-control errors)', async () => {
  await openWebPod('php-fpm')
  await win.getByRole('button', { name: /Abrir shell/ }).click()
  const term = win.getByTestId('shell-term')
  await expect(term).toContainText('fake-shell tty=yes')
  await expect(term).not.toContainText('Inappropriate ioctl')
  await term.click()
  await win.keyboard.type('echo ok')
  await win.keyboard.press('Enter')
  await expect(term).toContainText('echo ok')
  await win.screenshot({ path: 'test-results/ui-shell.png' })
})
