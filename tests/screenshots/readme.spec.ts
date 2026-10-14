// README screenshots (docs/images/ in Portuguese, docs/images/en/ in English) with the fake kubectl and
// fictional logs. Not part of the harness: run `make screenshots` on macOS (sips resizes to 1600×921).
// With LOGDECK_SITE_SHOTS=1 (`make site-shots`) it makes the website's Retina JPEGs instead
// (site/media/shots/<lang>/, 1440×900 window, no build scenes).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { translator, type Translate } from '../../src/ui/i18n/core'
import { fakeKubectlEnv } from '../helpers/fake-kubectl'

const SITE = process.env['LOGDECK_SITE_SHOTS'] === '1'
const SIZE = SITE ? { width: 1440, height: 900 } : { width: 1600, height: 921 }
const OUT = SITE
  ? ({ en: 'site/media/shots/en', 'pt-BR': 'site/media/shots/pt-BR' } as const)
  : ({ en: 'docs/images/en', 'pt-BR': 'docs/images' } as const)

for (const lang of ['en', 'pt-BR'] as const) {
  test.describe(lang, () => {
    const t: Translate = translator(lang)
    let app: ElectronApplication
    let win: Page

    test.beforeEach(async () => {
      const fake = fakeKubectlEnv({ FAKE_KUBECTL_DELAY_MS: '0' })
      app = await electron.launch({
        args: ['.', `--lang=${lang}`],
        env: { ...(fake.env as Record<string, string>), LOGDECK_USER_DATA: mkdtempSync(join(tmpdir(), 'logdeck-shots-')) },
      })
      win = await app.firstWindow()
      await app.evaluate(({ BrowserWindow }, s) => BrowserWindow.getAllWindows()[0]!.setContentSize(s.width, s.height), SIZE)
      await win.getByTestId('welcome').waitFor()
      // The update question is asked once; answer it so it does not show in every picture.
      await win.getByTestId('update-ask').getByRole('button', { name: t('upd.askNo') }).click()
    })

    test.afterEach(async () => {
      await app.close()
    })

    const nav = () => win.getByRole('navigation', { name: t('sidebar.navigation') })

    async function openPod(pod: RegExp, container?: string) {
      await nav().getByRole('button', { name: 'portal-hml', exact: true }).click()
      await nav().getByRole('button', { name: pod }).click()
      if (container) await nav().getByRole('group', { name: t('sidebar.containers') }).getByRole('button', { name: container, exact: true }).click()
    }

    async function openWeb() {
      await openPod(/portal-web/, 'httpd')
      await expect(win.getByTestId('match-count')).toContainText('/ 465')
    }

    async function openBuilds() {
      await nav().getByRole('button', { name: 'portal-hml', exact: true }).click()
      await nav().getByRole('button', { name: new RegExp(t('sidebar.buildsFolder')) }).click()
      return nav().getByRole('list', { name: t('sidebar.buildsFolder') })
    }

    /** Lets animations settle, then saves at 1600×921 (the window is captured at the screen's scale). */
    async function shot(name: string) {
      await win.waitForTimeout(500)
      const file = join(OUT[lang], `${name}.png`)
      await win.screenshot({ path: file })
      if (SITE) {
        execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', file, '--out', file.replace(/png$/, 'jpg')], { stdio: 'ignore' })
        rmSync(file)
      } else {
        execFileSync('sips', ['-z', String(SIZE.height), String(SIZE.width), file], { stdio: 'ignore' })
      }
    }

    test('welcome', async () => {
      await openWeb()
      await win.getByRole('button', { name: t('tabs.home'), exact: true }).click()
      await shot('welcome')
    })

    test('main', async () => {
      await openWeb()
      await shot('main')
    })

    test('details', async () => {
      await openWeb()
      await win.getByLabel(t('top.search')).fill('AH01075')
      await win.getByTestId('log-row').first().click()
      await expect(win.getByTestId('log-details')).toBeVisible()
      await shot('details')
    })

    test('errors', async () => {
      await openWeb()
      await win.getByTestId('error-group').filter({ hasText: t('sig.apache-phpfpm-timeout') }).getByRole('button').click()
      await shot('errors')
    })

    test('build-log', async () => {
      test.skip(SITE, 'the website does not show builds')
      const builds = await openBuilds()
      await builds.getByRole('button', { name: /portal-web-12/ }).click()
      await expect(win.locator('.statusbar')).toContainText('sti-build')
      await expect(win.getByTestId('log-row').filter({ hasText: 'Push successful' })).toHaveCount(1)
      await shot('build-log')
    })

    test('build-details', async () => {
      test.skip(SITE, 'the website does not show builds')
      const builds = await openBuilds()
      await builds.getByRole('button', { name: /portal-web-11/ }).click()
      await shot('build-details')
    })

    test('compare', async () => {
      await openPod(/portal-worker/)
      await win.getByRole('button', { name: t('lv.compare') }).click()
      await expect(win.getByTestId('previous-pane').getByTestId('log-row').first()).toBeVisible()
      await shot('compare')
    })

    test('theme-light', async () => {
      await win.getByRole('button', { name: t('sidebar.preferences'), exact: true }).click()
      const prefs = win.getByRole('dialog', { name: t('pref.title') })
      await prefs.getByRole('radio', { name: t('theme.claro') }).click()
      await prefs.getByRole('button', { name: t('common.close') }).click()
      await openWeb()
      await shot('theme-light')
    })

    test('preferences', async () => {
      await win.getByRole('button', { name: t('sidebar.preferences'), exact: true }).click()
      await shot('preferences')
    })

    test('shortcuts', async () => {
      await win.keyboard.press('?')
      await expect(win.getByRole('dialog', { name: t('keys.title') })).toBeVisible()
      await shot('shortcuts')
    })
  })
}
