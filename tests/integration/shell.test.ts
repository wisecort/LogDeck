import { afterEach, describe, expect, it } from 'vitest'
import { UnsafeArgsError, type PodTarget } from '../../src/k8s/args'
import { PodShell, ShellRegistry } from '../../src/k8s/shell'
import { fakeKubectlEnv } from '../helpers/fake-kubectl'

const HML = 'portal-hml/api-hml-example-internal:6443/dev'
const TARGET: PodTarget = { context: HML, knownContexts: [HML], namespace: 'portal-hml', pod: 'portal-web-7d9f8c6b5-x2k4p', container: 'php-fpm' }

const shells: PodShell[] = []
afterEach(() => shells.splice(0).forEach((s) => s.close()))

async function waitFor(cond: () => boolean, timeoutMs = 5000) {
  const t0 = Date.now()
  while (!cond()) {
    if (Date.now() - t0 > timeoutMs) throw new Error('waitFor timed out')
    await new Promise((r) => setTimeout(r, 10))
  }
}

function open(target = TARGET) {
  const fake = fakeKubectlEnv()
  let out = ''
  let exitCode: number | undefined
  const shell = new PodShell({
    target,
    cols: 100,
    rows: 30,
    kubectl: { env: fake.env },
    onData: (d) => (out += d),
    onExit: (code) => (exitCode = code),
  })
  shells.push(shell)
  return { shell, fake, out: () => out, exitCode: () => exitCode }
}

describe('PodShell (P5)', () => {
  it('runs kubectl exec -it inside a real pseudo-terminal', async () => {
    const s = open()
    await waitFor(() => s.out().includes('fake-shell'))
    expect(s.out()).toContain('fake-shell tty=yes cols=100 rows=30')
    expect(s.out()).not.toContain('Inappropriate ioctl for device')
    expect(s.out()).not.toContain('no job control')
    expect(s.fake.calls()[0]!.slice(0, 2)).toEqual(['exec', '-it'])
  })

  it('forwards input and window resizes', async () => {
    const s = open()
    await waitFor(() => s.out().includes('$ '))
    s.shell.write('echo hello\r')
    await waitFor(() => s.out().includes('echo hello'))
    s.shell.resize(120, 40)
    await waitFor(() => s.out().includes('resize cols=120 rows=40'))
  })

  it('reports exit when the remote shell ends', async () => {
    const s = open()
    await waitFor(() => s.out().includes('$ '))
    s.shell.write('exit\r')
    await waitFor(() => s.exitCode() !== undefined)
    expect(s.exitCode()).toBe(0)
  })

  it('refuses an invalid target before spawning anything', () => {
    const fake = fakeKubectlEnv()
    expect(
      () =>
        new PodShell({ target: { ...TARGET, pod: 'x;rm -rf /' }, cols: 80, rows: 24, kubectl: { env: fake.env }, onData: () => {}, onExit: () => {} }),
    ).toThrow(UnsafeArgsError)
    expect(fake.calls()).toEqual([])
  })

  it('closes every shell through the registry (app quit)', async () => {
    const registry = new ShellRegistry()
    const a = open()
    const b = open()
    const ids = [registry.add(a.shell), registry.add(b.shell)]
    expect(registry.get(ids[0]!)).toBe(a.shell)
    await waitFor(() => a.out().includes('$ ') && b.out().includes('$ '))
    const pids = [a.shell.pid, b.shell.pid]
    registry.closeAll()
    await waitFor(() =>
      pids.every((pid) => {
        try {
          process.kill(pid, 0)
          return false
        } catch {
          return true
        }
      }),
    )
    expect(registry.size).toBe(0)
  })
})
