// Full path renderer → preload → main → kubectl (fake) → back, without a real cluster.
import { execFileSync } from 'node:child_process'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import { fakeKubectlEnv } from '../helpers/fake-kubectl'

const HML = 'portal-hml/api-hml-example-internal:6443/dev'

function kubectlLogsProcesses(): string[] {
  try {
    return execFileSync('pgrep', ['-f', 'node .*tests/bin/kubectl logs'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  } catch {
    return [] // pgrep exits 1 when nothing matches
  }
}

async function launch(extra: Record<string, string> = {}): Promise<{ app: ElectronApplication; calls: () => string[][] }> {
  const fake = fakeKubectlEnv({ FAKE_KUBECTL_DELAY_MS: '0', ...extra })
  const app = await electron.launch({ args: ['.', '--lang=pt-BR'], env: fake.env as Record<string, string> })
  return { app, calls: fake.calls }
}

test('navigates context → namespace → pod through the preload API (F1, F2)', async () => {
  const { app, calls } = await launch()
  try {
    const win = await app.firstWindow()
    const result = await win.evaluate(async (ctx) => {
      const version = await window.logdeck.kubectlVersion()
      const contexts = await window.logdeck.listContexts()
      const ns = await window.logdeck.listNamespaces(ctx)
      const pods = await window.logdeck.listPods(ctx, 'portal-hml')
      return { version, contexts, ns, pods: pods.map((p) => [p.name, p.status, p.restarts]) }
    }, HML)
    expect(result.version).toEqual({ installed: true, version: 'v1.34.1-fake' })
    expect(result.contexts.map((c) => [c.name, c.current, c.production])).toEqual([
      [HML, true, false],
      ['portal-prd/api-prd-example-internal:6443/dev', false, true],
      ['kind-logdeck-test', false, false],
    ])
    expect(result.ns.namespaces).toContain('portal-hml')
    expect(result.pods).toContainEqual(['portal-worker-5c7d9b8f4-q8w2e', 'CrashLoopBackOff', 14])
    for (const call of calls()) expect(call).not.toContain('use-context')
  } finally {
    await app.close()
  }
})

test('rejects unsafe input coming from the renderer (G1, G2)', async () => {
  const { app, calls } = await launch()
  try {
    const win = await app.firstWindow()
    const errors = await win.evaluate(async (ctx) => {
      const out: string[] = []
      for (const attempt of [
        () => window.logdeck.listPods('evil-context', 'portal-hml'),
        () => window.logdeck.listPods(ctx, '$(id)'),
        () => window.logdeck.startLogs({ context: ctx, namespace: 'portal-hml', pod: 'x;rm -rf /', container: 'httpd' }),
      ]) {
        try {
          await attempt()
          out.push('accepted')
        } catch (err) {
          out.push((err as Error).message)
        }
      }
      return out
    }, HML)
    expect(errors).toHaveLength(3)
    for (const e of errors) expect(e).not.toBe('accepted')
    expect(calls().every((c) => c[0] === 'config' || c[0] === 'version')).toBe(true)
  } finally {
    await app.close()
  }
})

test('streams live logs and leaves no kubectl behind when the app quits (F3, F3.5)', async () => {
  expect(kubectlLogsProcesses()).toEqual([])
  const { app } = await launch()
  const win = await app.firstWindow()
  const received = await win.evaluate(async (ctx) => {
    const lines: string[] = []
    const states: string[] = []
    window.logdeck.onLogLines((e) => lines.push(...e.lines))
    window.logdeck.onLogStatus((e) => states.push(e.status.state))
    await window.logdeck.startLogs({ context: ctx, namespace: 'portal-hml', pod: 'portal-web-7d9f8c6b5-x2k4p', container: 'httpd' })
    const t0 = Date.now()
    while (lines.length < 475 && Date.now() - t0 < 10_000) await new Promise((r) => setTimeout(r, 50))
    return { count: lines.length, first: lines[0], states }
  }, HML)
  expect(received.count).toBe(475)
  expect(received.first).toMatch(/^2026-10-09T03:24:00\.\d+Z chown:/)
  expect(received.states).toContain('live')
  expect(kubectlLogsProcesses()).toHaveLength(1)
  await app.close()
  await expect.poll(kubectlLogsProcesses, { timeout: 5000 }).toEqual([])
})
