import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { UnsafeArgsError } from '../../src/k8s/args'
import { KubectlError, runKubectl, spawnKubectl } from '../../src/k8s/kubectl'
import { fakeKubectlEnv } from '../helpers/fake-kubectl'
import { kubectlInstallHint } from '../../src/platform/paths'

const CTX = '--context=portal-hml/api-hml-example-internal:6443/dev'

describe('runKubectl', () => {
  it('runs an allowed command and captures stdout', async () => {
    const fake = fakeKubectlEnv()
    const r = await runKubectl(['config', 'get-contexts'], { env: fake.env })
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('kind-logdeck-test')
    expect(fake.calls()).toEqual([['config', 'get-contexts']])
  })

  it('refuses a write verb before spawning anything (G1)', async () => {
    const fake = fakeKubectlEnv()
    await expect(runKubectl(['delete', 'pod', 'x', CTX], { env: fake.env })).rejects.toThrow(UnsafeArgsError)
    await expect(runKubectl(['config', 'use-context', 'x'], { env: fake.env })).rejects.toThrow(UnsafeArgsError)
    expect(fake.calls()).toEqual([])
  })

  it('returns non-zero exits with stderr', async () => {
    const fake = fakeKubectlEnv({ FAKE_KUBECTL_MODE: 'auth-error' })
    const r = await runKubectl(['get', 'pods', '-n', 'portal-hml', '-o', 'json', CTX], { env: fake.env })
    expect(r.code).toBe(1)
    expect(r.stderr).toContain('Unauthorized')
  })

  it('reports a missing binary with an actionable message', async () => {
    await expect(runKubectl(['config', 'get-contexts'], { binary: 'kubectl-not-installed-xyz', env: fakeKubectlEnv().env })).rejects.toThrow(
      new RegExp(kubectlInstallHint().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    )
  })

  it('kills the process when it exceeds the timeout', async () => {
    const fake = fakeKubectlEnv()
    const t0 = Date.now()
    await expect(runKubectl(['logs', 'p', '-n', 'portal-hml', '-f', '--tail=1', CTX], { env: fake.env, timeoutMs: 300 })).rejects.toThrow(KubectlError)
    expect(Date.now() - t0).toBeLessThan(3000)
    await new Promise((r) => setTimeout(r, 100))
    if (process.platform === 'win32') return // no POSIX `ps`; the timeout itself is checked above
    const running = execFileSync('ps', ['-axo', 'command'], { encoding: 'utf8' })
      .split('\n')
      .filter((cmd) => /^\S*node \S*tests\/bin\/kubectl logs p -n portal-hml -f --tail=1/.test(cmd))
    expect(running).toEqual([])
  })
})

describe('spawnKubectl', () => {
  it('validates argv too', () => {
    expect(() => spawnKubectl(['scale', 'deploy/x', CTX], { env: fakeKubectlEnv().env })).toThrow(UnsafeArgsError)
  })

  it('spawns without a shell', async () => {
    const fake = fakeKubectlEnv()
    const child = spawnKubectl(['logs', 'p', '-n', 'portal-hml', '--timestamps', '--tail=2', CTX], { env: fake.env })
    let out = ''
    child.stdout!.on('data', (d) => (out += d))
    await new Promise((r) => child.on('exit', r))
    expect(out.trim().split('\n')).toHaveLength(2)
    expect(child.spawnargs[0]).toBe('kubectl')
  })
})
