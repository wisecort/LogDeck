import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { fakeKubectlEnv } from '../helpers/fake-kubectl'
import { HML, navTree } from '../helpers/ui'

test('opens as LogDeck', async () => {
  // Fake kubectl + fake kubeconfig: tests never read ~/.kube (AGENTS.md).
  const fake = fakeKubectlEnv()
  const app = await electron.launch({
    args: ['.', '--lang=pt-BR'],
    env: { ...(fake.env as Record<string, string>), LOGDECK_USER_DATA: mkdtempSync(join(tmpdir(), 'logdeck-e2e-')) },
  })
  try {
    const win = await app.firstWindow()
    await expect(win).toHaveTitle('LogDeck')
    await expect(win.getByLabel('Contexto', { exact: true })).toHaveValue(HML)
    await expect(navTree(win).getByRole('button', { name: 'portal-hml', exact: true })).toBeVisible()
    expect(await app.evaluate(({ app }) => app.getName())).toBe('LogDeck')
    // Security baseline for the renderer (SPEC §2).
    expect(await win.evaluate(() => typeof (globalThis as { require?: unknown }).require)).toBe('undefined')
    await expect.poll(() => fake.calls().length).toBeGreaterThan(0)
  } finally {
    await app.close()
  }
})
