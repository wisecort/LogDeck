import { expect, type Page } from '@playwright/test'

export const HML = 'portal-hml/api-hml-example-internal:6443/dev'
export const PRD = 'portal-prd/api-prd-example-internal:6443/dev'

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const navTree = (win: Page) => win.getByRole('navigation', { name: 'Navegação' })

/** Opens context → namespace → pod (→ container) through the sidebar tree. */
export async function openPod(win: Page, opts: { context?: string; namespace?: string; pod: RegExp; container?: string }) {
  const nav = navTree(win)
  await nav.getByRole('button', { name: new RegExp(escapeRe(opts.context ?? HML)) }).click()
  await nav.getByRole('button', { name: opts.namespace ?? 'portal-hml', exact: true }).click()
  await nav.getByRole('button', { name: opts.pod }).click()
  if (opts.container) await nav.getByRole('group', { name: 'Containers' }).getByRole('button', { name: opts.container, exact: true }).click()
}

export async function openWebPod(win: Page, container = 'httpd') {
  await openPod(win, { pod: /portal-web/, container })
  await expect(win.getByTestId('stream-status')).toContainText('Live')
  await expect(win.getByTestId('match-count')).toContainText('/ 465')
}
