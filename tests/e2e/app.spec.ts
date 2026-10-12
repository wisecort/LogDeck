import { _electron as electron, expect, test } from '@playwright/test'

test('opens as LogDeck', async () => {
  const app = await electron.launch({ args: ['.'] })
  try {
    const win = await app.firstWindow()
    await expect(win).toHaveTitle('LogDeck')
    await expect(win.getByRole('heading', { name: 'LogDeck' })).toBeVisible()
    expect(await app.evaluate(({ app }) => app.getName())).toBe('LogDeck')

    // Security baseline for the renderer (SPEC §2).
    expect(await win.evaluate(() => typeof (globalThis as { require?: unknown }).require)).toBe('undefined')
  } finally {
    await app.close()
  }
})
