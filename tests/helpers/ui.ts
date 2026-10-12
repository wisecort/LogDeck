import { expect, type Page } from '@playwright/test'

export const HML = 'portal-hml/api-hml-example-internal:6443/dev'
export const PRD = 'portal-prd/api-prd-example-internal:6443/dev'

export const navTree = (win: Page) => win.getByRole('navigation', { name: 'Navegação' })

/** Switches the sidebar context picker (G4: nothing changes in the kubeconfig). */
export async function selectContext(win: Page, context: string) {
  await win.getByLabel('Contexto', { exact: true }).selectOption(context)
}

/** Opens context → namespace → pod (→ container) through the sidebar tree. */
export async function openPod(win: Page, opts: { context?: string; namespace?: string; pod: RegExp; container?: string }) {
  const nav = navTree(win)
  if (opts.context && opts.context !== HML) await selectContext(win, opts.context)
  await nav.getByRole('button', { name: opts.namespace ?? 'portal-hml', exact: true }).click()
  await nav.getByRole('button', { name: opts.pod }).click()
  if (opts.container) await nav.getByRole('group', { name: 'Containers' }).getByRole('button', { name: opts.container, exact: true }).click()
}

export async function openWebPod(win: Page, container = 'httpd') {
  await openPod(win, { pod: /portal-web/, container })
  await expect(win.getByTestId('stream-status')).toContainText('Conectado')
  await expect(win.getByTestId('match-count')).toContainText('/ 465')
}
