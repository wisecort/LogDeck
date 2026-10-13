import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { PodTarget } from '../../src/k8s/args'
import { LogStream, StreamRegistry, type StreamStatus } from '../../src/k8s/stream'
import { fixtureLines } from '../helpers/entries'
import { fakeKubectlEnv } from '../helpers/fake-kubectl'

const HML = 'portal-hml/api-hml-example-internal:6443/dev'
const TARGET: PodTarget = {
  context: HML,
  knownContexts: [HML],
  namespace: 'portal-hml',
  pod: 'portal-web-7d9f8c6b5-x2k4p',
  container: 'httpd',
}
const POD_LINES = fixtureLines('pod-php-apache.log')

const open: LogStream[] = []
afterEach(async () => {
  await Promise.all(open.splice(0).map((s) => s.stop()))
})

async function waitFor(cond: () => boolean, timeoutMs = 5000): Promise<void> {
  const t0 = Date.now()
  while (!cond()) {
    if (Date.now() - t0 > timeoutMs) throw new Error('waitFor timed out')
    await new Promise((r) => setTimeout(r, 10))
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function startStream(extraEnv: Record<string, string>, opts: Partial<ConstructorParameters<typeof LogStream>[0]> = {}) {
  const fake = fakeKubectlEnv({ FAKE_KUBECTL_DELAY_MS: '0', ...extraEnv })
  const lines: string[] = []
  const batches: number[] = []
  const statuses: StreamStatus[] = []
  const delays: number[] = []
  const stream = new LogStream({
    target: TARGET,
    tail: 1000,
    kubectl: { env: fake.env },
    // Record the requested back-off but retry almost immediately.
    schedule: (fn, ms) => {
      delays.push(ms)
      const t = setTimeout(fn, 1)
      return () => clearTimeout(t)
    },
    onLines: (ls) => {
      batches.push(ls.length)
      lines.push(...ls)
    },
    onStatus: (s) => statuses.push(s),
    ...opts,
  })
  open.push(stream)
  stream.start()
  return { stream, lines, batches, statuses, delays, fake }
}

describe('LogStream (F3)', () => {
  it('streams every line with --timestamps -f --tail, in batches', async () => {
    const s = startStream({})
    await waitFor(() => s.lines.length === POD_LINES.length)
    expect(s.lines).toEqual(POD_LINES)
    expect(s.batches.length).toBeLessThan(POD_LINES.length / 10)
    const [argv] = s.fake.calls()
    expect(argv).toEqual(expect.arrayContaining(['logs', '--timestamps', '-f', '--tail=1000', `--context=${HML}`]))
    expect(s.statuses[0]).toEqual({ state: 'connecting' })
    expect(s.statuses).toContainEqual({ state: 'live' })
  })

  it('passes --since when asked', async () => {
    const s = startStream({}, { since: '15m' })
    await waitFor(() => s.fake.calls().length === 1)
    expect(s.fake.calls()[0]).toContain('--since=15m')
  })

  it('reconnects with back-off 1s, 2s, 5s, 10s, 10s when the stream keeps dropping (F3.4)', async () => {
    const s = startStream({ FAKE_KUBECTL_MODE: 'drop-after:0' })
    await waitFor(() => s.delays.length >= 5)
    expect(s.delays.slice(0, 5)).toEqual([1000, 2000, 5000, 10_000, 10_000])
    const reconnecting = s.statuses.filter((x) => x.state === 'reconnecting')
    expect(reconnecting.slice(0, 3)).toEqual([
      { state: 'reconnecting', attempt: 1, retryInMs: 1000, message: expect.any(String) },
      { state: 'reconnecting', attempt: 2, retryInMs: 2000, message: expect.any(String) },
      { state: 'reconnecting', attempt: 3, retryInMs: 5000, message: expect.any(String) },
    ])
  })

  it('resumes with --since-time and delivers no duplicate lines', async () => {
    const s = startStream({ FAKE_KUBECTL_MODE: 'drop-after:5' })
    await waitFor(() => s.lines.length >= 20)
    await s.stream.stop()
    expect(s.lines).toEqual(POD_LINES.slice(0, s.lines.length))
    const [, second] = s.fake.calls()
    const ts5 = POD_LINES[4]!.slice(0, POD_LINES[4]!.indexOf(' '))
    expect(second).toContain(`--since-time=${ts5}`)
    expect(second!.some((a) => a.startsWith('--tail'))).toBe(false)
    // Lines arrived after each reconnect, so the back-off reset every time.
    expect(new Set(s.delays)).toEqual(new Set([1000]))
  })

  it('stops with an actionable error on authentication failure, without retrying', async () => {
    const s = startStream({ FAKE_KUBECTL_MODE: 'auth-error' })
    await waitFor(() => s.statuses.some((x) => x.state === 'error'))
    await new Promise((r) => setTimeout(r, 200))
    expect(s.statuses.at(-1)).toMatchObject({ state: 'error', message: expect.stringContaining('oc login') })
    expect(s.fake.calls()).toHaveLength(1)
  })

  it('ends when the pod no longer exists, without retrying', async () => {
    const s = startStream({ FAKE_KUBECTL_MODE: 'not-found' })
    await waitFor(() => s.statuses.some((x) => x.state === 'ended'))
    expect(s.statuses.at(-1)).toMatchObject({ state: 'ended', message: expect.stringContaining('não encontrado') })
    expect(s.fake.calls()).toHaveLength(1)
  })

  it('reads the previous container log once with --previous (F3.2)', async () => {
    const s = startStream({}, { previous: true })
    await waitFor(() => s.statuses.some((x) => x.state === 'ended'))
    expect(s.lines.at(-1)).toContain('FPM initialization failed')
    const [argv] = s.fake.calls()
    expect(argv).toContain('--previous')
    expect(argv).not.toContain('-f')
    expect(s.delays).toEqual([])
  })

  it('reads a finished container (completed build, Job) once: no -f, no reconnect', async () => {
    const s = startStream({}, { once: true })
    await waitFor(() => s.statuses.some((x) => x.state === 'ended'))
    expect(s.lines.length).toBeGreaterThan(0)
    const [argv] = s.fake.calls()
    expect(argv).not.toContain('-f')
    expect(s.fake.calls()).toHaveLength(1)
    expect(s.delays).toEqual([])
  })

  it('kills kubectl on stop and does not reconnect afterwards (F3.5)', async () => {
    const s = startStream({ FAKE_KUBECTL_DELAY_MS: '50' })
    await waitFor(() => s.lines.length > 0)
    const pid = s.stream.pid!
    expect(alive(pid)).toBe(true)
    await s.stream.stop()
    expect(alive(pid)).toBe(false)
    await new Promise((r) => setTimeout(r, 100))
    expect(s.delays).toEqual([])
    expect(s.statuses.at(-1)).toEqual({ state: 'ended' })
  })

  it('sustains a burst of 60,000 lines without losing or reordering any (RNF1)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'logdeck-burst-'))
    const file = join(dir, 'burst.log')
    const base = Date.parse('2026-10-09T03:00:00Z')
    const burst = Array.from({ length: 60_000 }, (_, i) => `${new Date(base + i).toISOString()} line ${i} ${'x'.repeat(i % 80)}`)
    writeFileSync(file, burst.join('\n') + '\n')
    const t0 = Date.now()
    const s = startStream({ FAKE_KUBECTL_LOG_FILE: file }, { tail: -1 })
    await waitFor(() => s.lines.length === burst.length, 10_000)
    const elapsed = Date.now() - t0
    expect(s.lines).toEqual(burst)
    expect(s.batches.length).toBeLessThanOrEqual(elapsed / 100 + 5)
  })
})

describe('StreamRegistry', () => {
  it('stops every open stream (tab closed / app quit)', async () => {
    const registry = new StreamRegistry()
    const streams = [1, 2, 3].map(() => startStream({ FAKE_KUBECTL_DELAY_MS: '50' }))
    const ids = streams.map((s) => registry.add(s.stream))
    expect(new Set(ids).size).toBe(3)
    expect(registry.get(ids[0]!)).toBe(streams[0]!.stream)
    await waitFor(() => streams.every((s) => s.stream.pid !== undefined && s.lines.length > 0))
    const pids = streams.map((s) => s.stream.pid!)
    await registry.stop(ids[0]!)
    expect(alive(pids[0]!)).toBe(false)
    expect(registry.size).toBe(2)
    await registry.stopAll()
    expect(pids.map(alive)).toEqual([false, false, false])
    expect(registry.size).toBe(0)
  })
})
