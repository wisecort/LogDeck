// Contract of the fake kubectl used by the integration and E2E tests.
import { spawn, spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { fakeKubectlEnv } from '../helpers/fake-kubectl'

const CTX = '--context=portal-hml/api-hml-example-internal:6443/dev'

function kubectl(args: string[], extra: Record<string, string> = {}) {
  const fake = fakeKubectlEnv(extra)
  const r = spawnSync('kubectl', args, { env: fake.env, encoding: 'utf8' })
  return { ...r, calls: fake.calls() }
}

describe('fake kubectl', () => {
  it('is the one resolved from PATH', () => {
    const r = kubectl(['version', '--client', '-o', 'json'])
    expect(r.status).toBe(0)
    expect(JSON.parse(r.stdout).clientVersion.gitVersion).toContain('fake')
  })

  it('records argv of every call', () => {
    const r = kubectl(['config', 'get-contexts'])
    expect(r.calls).toEqual([['config', 'get-contexts']])
    expect(r.stdout).toContain('kind-logdeck-test')
  })

  it.each([
    [['delete', 'pod', 'x', CTX]],
    [['config', 'use-context', 'kind-logdeck-test']],
    [['config', 'view', '--raw']],
    [['scale', 'deploy/x', '--replicas=0', CTX]],
  ])('refuses forbidden invocation %j with exit 99', (args) => {
    expect(kubectl(args).status).toBe(99)
  })

  it('requires --context on cluster calls', () => {
    expect(kubectl(['get', 'pods', '-n', 'portal-hml', '-o', 'json']).status).toBe(98)
  })

  it('lists namespaces and pods as JSON', () => {
    const ns = kubectl(['get', 'namespaces', '-o', 'json', CTX])
    expect(JSON.parse(ns.stdout).items).toHaveLength(3)
    const pods = kubectl(['get', 'pods', '-n', 'portal-hml', '-o', 'json', CTX])
    expect(JSON.parse(pods.stdout).items.map((p: { metadata: { name: string } }) => p.metadata.name)).toContain(
      'portal-worker-5c7d9b8f4-q8w2e',
    )
  })

  it('simulates an authentication error', () => {
    const r = kubectl(['get', 'pods', '-n', 'portal-hml', '-o', 'json', CTX], { FAKE_KUBECTL_MODE: 'auth-error' })
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('Unauthorized')
  })

  it('serves logs with --timestamps and --tail', () => {
    const r = kubectl(['logs', 'portal-web-7d9f8c6b5-x2k4p', '-c', 'httpd', '-n', 'portal-hml', '--timestamps', '--tail=3', CTX])
    const lines = r.stdout.trim().split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toMatch(/^2026-10-09T\d{2}:\d{2}:\d{2}(\.\d+)?Z /)
  })

  it('strips timestamps without --timestamps and honours --since-time', () => {
    const r = kubectl(['logs', 'p', '-n', 'portal-hml', '--since-time=2026-10-09T03:28:59Z', CTX])
    expect(r.stdout).not.toMatch(/^2026-10-09T/m)
    expect(r.stdout.trim().split('\n').length).toBeGreaterThan(0)
    expect(r.stdout.trim().split('\n').length).toBeLessThan(10)
  })

  it('serves the previous container log with --previous', () => {
    const r = kubectl(['logs', 'portal-worker-5c7d9b8f4-q8w2e', '-n', 'portal-hml', '--previous', '--timestamps', CTX])
    expect(r.stdout).toContain('FPM initialization failed')
  })

  it('drops the stream after N lines in drop-after mode', () => {
    const r = kubectl(['logs', 'p', '-n', 'portal-hml', '-f', '--timestamps', CTX], { FAKE_KUBECTL_MODE: 'drop-after:5' })
    expect(r.status).toBe(1)
    expect(r.stdout.trim().split('\n')).toHaveLength(5)
    expect(r.stderr).toContain('unexpected EOF')
  })

  it('keeps a -f stream open until killed', async () => {
    const fake = fakeKubectlEnv({ FAKE_KUBECTL_DELAY_MS: '0', FAKE_KUBECTL_LOG_FILE: 'startup.log' })
    const child = spawn('kubectl', ['logs', 'p', '-n', 'portal-hml', '-f', CTX], { env: fake.env })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    await new Promise((r) => setTimeout(r, 500))
    expect(child.exitCode).toBeNull()
    expect(out).toContain('Starting php-fpm')
    child.kill('SIGTERM')
    const signal = await new Promise((r) => child.on('exit', (_c, s) => r(s)))
    expect(signal).toBe('SIGTERM')
  })

  it('prints the no-TTY errors of P5 when exec has no terminal', () => {
    const r = kubectl(['exec', '-it', 'p', '-n', 'portal-hml', CTX, '--', 'sh'], {})
    expect(r.stderr).toContain('Inappropriate ioctl for device')
  })
})
