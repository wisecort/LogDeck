import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { fakeKubectlEnv } from '../helpers/fake-kubectl'

// The update check never touches the network in tests: main reads LOGDECK_UPDATE_FEED instead.
async function launch() {
  const dir = mkdtempSync(join(tmpdir(), 'logdeck-e2e-update-'))
  const feed = join(dir, 'latest.json')
  writeFileSync(feed, JSON.stringify({ tag_name: 'v9.9.0', draft: false, prerelease: false }))
  const fake = fakeKubectlEnv()
  return electron.launch({
    args: ['.', '--lang=pt-BR'],
    env: { ...(fake.env as Record<string, string>), LOGDECK_USER_DATA: join(dir, 'data'), LOGDECK_UPDATE_FEED: feed },
  })
}

test('asks before checking for updates, then shows the new version and how to update', async () => {
  const app = await launch()
  try {
    const win = await app.firstWindow()
    await expect(win.getByTestId('update-ask')).toBeVisible()
    await expect(win.getByTestId('update-pill')).toHaveCount(0)

    await win.getByTestId('update-ask').getByRole('button', { name: 'Avisar' }).click()
    await expect(win.getByTestId('update-ask')).toHaveCount(0)
    await expect(win.getByTestId('update-pill')).toHaveText('9.9.0 disponível')

    await win.getByTestId('update-pill').click()
    const modal = win.getByRole('dialog', { name: 'LogDeck 9.9.0 disponível' })
    await expect(modal).toContainText('winget upgrade wisecort.LogDeck')
    await expect(modal).toContainText('brew upgrade --cask logdeck')
    await modal.getByRole('button', { name: 'Pular esta versão' }).click()
    await expect(modal).toHaveCount(0)
    await expect(win.getByTestId('update-pill')).toHaveCount(0)
  } finally {
    await app.close()
  }
})

test('"Agora não" never checks and can be turned on later in Preferences', async () => {
  const app = await launch()
  try {
    const win = await app.firstWindow()
    await win.getByTestId('update-ask').getByRole('button', { name: 'Agora não' }).click()
    await expect(win.getByTestId('update-ask')).toHaveCount(0)
    await expect(win.getByTestId('update-pill')).toHaveCount(0)

    await win.getByRole('button', { name: 'Preferências', exact: true }).click()
    const toggle = win.getByRole('checkbox', { name: 'Avisar quando houver versão nova' })
    await expect(toggle).not.toBeChecked()
    await toggle.check()
    await expect(win.getByTestId('update-pill')).toHaveText('9.9.0 disponível')
  } finally {
    await app.close()
  }
})
