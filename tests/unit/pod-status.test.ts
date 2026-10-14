import { describe, expect, it } from 'vitest'
import type { ContainerDetail, PodInfo } from '../../src/shared/ipc'
import { containerDetail, formatDuration, recordRuns, uptime } from '../../src/ui/pod-status'

const T0 = Date.parse('2026-10-09T14:00:00Z')

const worker = (over: Partial<ContainerDetail> = {}): ContainerDetail => ({
  name: 'worker',
  init: false,
  state: 'running',
  restarts: 4,
  startedAt: T0,
  last: { reason: 'OOMKilled', exitCode: 137, startedAt: T0 - 365_000 - 25_000, finishedAt: T0 - 25_000 },
  ...over,
})

const pod = (details: ContainerDetail[]): PodInfo => ({
  name: 'portal-worker-5c8d9',
  namespace: 'portal-hml',
  phase: 'Running',
  status: 'Running',
  ready: '1/1',
  restarts: 4,
  createdAt: T0 - 5 * 86_400_000,
  containers: ['worker'],
  initContainers: [],
  canPrevious: true,
  kind: 'app',
  details,
})

describe('formatDuration', () => {
  it.each([
    [0, '0s'],
    [42_000, '42s'],
    [94_000, '1m 34s'],
    [365_000, '6m 05s'],
    [2 * 3_600_000 + 3 * 60_000, '2h 03m'],
    [5 * 86_400_000 + 3 * 3_600_000, '5d 3h'],
  ])('%i ms → %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text)
  })

  it('never goes negative (clock skew between the machine and the cluster)', () => {
    expect(formatDuration(-5000)).toBe('0s')
  })
})

describe('containerDetail and uptime', () => {
  it('finds the container of the tab', () => {
    expect(containerDetail(pod([worker()]), 'worker')?.restarts).toBe(4)
    expect(containerDetail(pod([worker()]), 'other')).toBeUndefined()
    expect(containerDetail(undefined, 'worker')).toBeUndefined()
  })

  it('is the time since the current run started, only while running', () => {
    expect(uptime(worker(), T0 + 94_000)).toBe(94_000)
    expect(uptime(worker({ state: 'waiting', reason: 'CrashLoopBackOff' }), T0 + 94_000)).toBeUndefined()
    expect(uptime(worker({ startedAt: undefined }), T0)).toBeUndefined()
  })
})

describe('recordRuns (runs seen while the app is open)', () => {
  it('keeps the previous run once, newest first', () => {
    let runs = recordRuns([], worker())
    runs = recordRuns(runs, worker())
    expect(runs).toEqual([worker().last])
  })

  it('adds a new run when the container restarts again', () => {
    const first = recordRuns([], worker())
    const later = worker({ restarts: 5, last: { reason: 'Error', exitCode: 1, startedAt: T0, finishedAt: T0 + 60_000 } })
    expect(recordRuns(first, later).map((r) => r.reason)).toEqual(['Error', 'OOMKilled'])
  })

  it('keeps at most 10 runs and ignores containers without a finished run', () => {
    let runs = recordRuns([], worker({ last: undefined }))
    expect(runs).toEqual([])
    for (let i = 0; i < 15; i++) runs = recordRuns(runs, worker({ last: { reason: 'Error', finishedAt: T0 + i * 1000 } }))
    expect(runs).toHaveLength(10)
    expect(runs[0]!.finishedAt).toBe(T0 + 14_000)
  })
})
