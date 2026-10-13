import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { kubectlInstallHint } from '../../src/platform/paths'
import { fakeKubectlEnv } from '../helpers/fake-kubectl'

// LOGDECK_KUBECTL_BIN points main at a kubectl that does not exist (tests only), like a fresh machine.
async function launch(extra: Record<string, string> = {}) {
  const fake = fakeKubectlEnv()
  return electron.launch({
    args: ['.', '--lang=pt-BR'],
    env: { ...(fake.env as Record<string, string>), LOGDECK_USER_DATA: mkdtempSync(join(tmpdir(), 'logdeck-e2e-onb-')), ...extra },
  })
}

test('without kubectl the welcome screen says how to install it, copies the command and checks again', async () => {
  const app = await launch({ LOGDECK_KUBECTL_BIN: 'kubectl-not-installed-xyz' })
  // Copy writes to the real clipboard: put the user's content back afterwards.
  const saved = await app.evaluate(({ clipboard }) => clipboard.readText())
  try {
    const win = await app.firstWindow()
    const card = win.getByTestId('kubectl-missing')
    await expect(card).toBeVisible()
    await expect(card).toContainText('Falta o kubectl')
    await expect(card.getByTestId('kubectl-install-hint')).toHaveText(kubectlInstallHint())

    await card.getByRole('button', { name: 'Copiar' }).click()
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toBe(kubectlInstallHint())

    await card.getByRole('button', { name: 'Verificar de novo' }).click()
    await expect(card).toBeVisible()
    // Log files still work without kubectl.
    await expect(card).toContainText('abrir arquivos de log')
  } finally {
    await app.evaluate(({ clipboard }, text) => clipboard.writeText(text), saved)
    await app.close()
  }
})

test('with kubectl installed there is no install card', async () => {
  const app = await launch()
  try {
    const win = await app.firstWindow()
    await expect(win.getByTestId('welcome-status')).toContainText('kubectl')
    await expect(win.getByTestId('kubectl-missing')).toHaveCount(0)
    // Home is the house button: no empty "Início" tab in the bar.
    await expect(win.getByTestId('log-tab')).toHaveCount(0)
  } finally {
    await app.close()
  }
})
