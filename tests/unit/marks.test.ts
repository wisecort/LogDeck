import { describe, expect, it } from 'vitest'
import type { Row } from '../../src/logs/collapse'
import { placeMarks, quietMarks, restartMarks, trackReconnect, type Mark } from '../../src/logs/marks'
import { entry } from '../helpers/entries'

const T0 = Date.parse('2026-10-09T14:00:00Z')
const at = (s: number) => entry({ k8sTime: T0 + s * 1000 })
const rowsOf = (...secs: number[]): Row[] => secs.map((s) => ({ entry: at(s), count: 1 }))

describe('quietMarks: stretches where the container wrote nothing', () => {
  it('marks a gap longer than a minute in a busy log', () => {
    const entries = [0, 1, 2, 3, 4, 5, 135, 136].map(at)
    expect(quietMarks(entries)).toEqual([{ kind: 'quiet', time: T0 + 5000, from: T0 + 5000, to: T0 + 135_000 }])
  })

  it('ignores gaps under a minute', () => {
    expect(quietMarks([0, 30, 59].map(at))).toEqual([])
  })

  it('adapts to slow logs: a job that writes every 5 minutes is not "silent" between lines', () => {
    const entries = Array.from({ length: 12 }, (_, i) => at(i * 300))
    expect(quietMarks(entries)).toEqual([])
    // ...but a stretch 20× longer than usual still counts
    expect(quietMarks([...entries, at(11 * 300 + 7000)])).toHaveLength(1)
  })

  it('skips lines without a time and needs at least two timed lines', () => {
    expect(quietMarks([entry(), at(0)])).toEqual([])
    expect(quietMarks([at(0), entry(), at(200)])).toHaveLength(1)
  })
})

describe('trackReconnect: drops of the kubectl stream', () => {
  it('opens a mark when the stream starts reconnecting, at the last line received', () => {
    const marks = trackReconnect([], { state: 'reconnecting', attempt: 1 }, T0 + 100_000, T0 + 90_000)
    expect(marks).toEqual([{ kind: 'reconnect', time: T0 + 90_000, lostAt: T0 + 100_000 }])
  })

  it('keeps one mark through several attempts and closes it when live again', () => {
    let marks = trackReconnect([], { state: 'reconnecting', attempt: 1 }, T0, T0)
    marks = trackReconnect(marks, { state: 'reconnecting', attempt: 2 }, T0 + 2000, T0)
    marks = trackReconnect(marks, { state: 'live' }, T0 + 8000, T0)
    expect(marks).toEqual([{ kind: 'reconnect', time: T0, lostAt: T0, backAt: T0 + 8000 }])
  })

  it('a later drop is a new mark', () => {
    let marks = trackReconnect([], { state: 'reconnecting' }, T0, T0)
    marks = trackReconnect(marks, { state: 'live' }, T0 + 1000, T0)
    marks = trackReconnect(marks, { state: 'reconnecting' }, T0 + 60_000, T0 + 59_000)
    expect(marks).toHaveLength(2)
  })

  it('ignores the first connection and drops before any line arrived', () => {
    expect(trackReconnect([], { state: 'connecting' }, T0, undefined)).toEqual([])
    expect(trackReconnect([], { state: 'live' }, T0, T0)).toEqual([])
    expect(trackReconnect([], { state: 'reconnecting' }, T0, undefined)).toEqual([])
  })
})

describe('restartMarks: previous runs of the container', () => {
  it('one mark per run, at the time it ended, with reason, exit code and how long it ran', () => {
    const marks = restartMarks('worker', [{ reason: 'OOMKilled', exitCode: 137, startedAt: T0, finishedAt: T0 + 365_000 }, { reason: 'Error' }])
    expect(marks).toEqual([{ kind: 'restart', time: T0 + 365_000, container: 'worker', reason: 'OOMKilled', exitCode: 137, ranMs: 365_000 }])
  })
})

describe('placeMarks: marks go before the first line after them', () => {
  const quiet = (s: number): Mark => ({ kind: 'quiet', time: T0 + s * 1000, from: T0 + s * 1000, to: T0 + (s + 100) * 1000 })

  it('puts each mark before the first later row and the rest at the end', () => {
    const placed = placeMarks(rowsOf(0, 10, 20), [quiet(15), quiet(5), quiet(25)])
    expect([...placed.before.entries()].map(([i, m]) => [i, m.map((x) => x.time)])).toEqual([
      [1, [T0 + 5000]],
      [2, [T0 + 15_000]],
    ])
    expect(placed.trailing.map((m) => m.time)).toEqual([T0 + 25_000])
  })

  it('lines at the same time as the mark stay above it', () => {
    const placed = placeMarks(rowsOf(0, 10, 10, 11), [quiet(10)])
    expect([...placed.before.keys()]).toEqual([3])
  })

  it('drops marks older than the first line (outside the buffer) and outside a time range', () => {
    expect(placeMarks(rowsOf(10, 20), [quiet(5)]).before.size).toBe(0)
    const placed = placeMarks(rowsOf(10, 20, 30), [quiet(15), quiet(40)], [T0 + 10_000, T0 + 30_000])
    expect(placed.before.size).toBe(1)
    expect(placed.trailing).toEqual([])
  })

  it('rows without a time do not take marks; no rows means no marks', () => {
    const rows: Row[] = [{ entry: at(0), count: 1 }, { entry: entry(), count: 1 }, { entry: at(20), count: 1 }]
    expect([...placeMarks(rows, [quiet(10)]).before.keys()]).toEqual([2])
    expect(placeMarks([], [quiet(10)])).toEqual({ before: new Map(), trailing: [] })
  })
})
