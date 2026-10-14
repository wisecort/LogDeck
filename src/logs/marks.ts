// Marks between log lines: what happened while the list shows nothing (stream drops, silence, restarts).
// Pure TypeScript (no DOM); placed by time, so they work for any filter or collapse.
import type { PodEvent, StreamStatus, TerminatedRun } from '../shared/ipc'
import { timelineTime } from './classify'
import type { Row } from './collapse'
import type { LogEntry } from './types'

export type Mark =
  /** kubectl stream dropped; `time` is the last line received before the drop. */
  | { kind: 'reconnect'; time: number; lostAt: number; backAt?: number }
  /** Connected, but the container wrote nothing from `from` to `to`. */
  | { kind: 'quiet'; time: number; from: number; to: number }
  /** A previous run of the container ended (`time` = finishedAt). */
  | { kind: 'restart'; time: number; container: string; reason?: string; exitCode?: number; ranMs?: number }
  /** A Kubernetes event about the pod (`time` = last time it happened). */
  | { kind: 'event'; time: number; type: PodEvent['type']; reason: string; message: string; count: number; firstTime?: number }

export const QUIET_MIN_MS = 60_000
/** A stretch is silent only if it is this many times longer than the usual gap between lines. */
const QUIET_FACTOR = 20
/** Below this many gaps the median says little; the fixed minimum applies. */
const MIN_GAPS_FOR_MEDIAN = 10

export function quietMarks(entries: readonly LogEntry[]): Mark[] {
  const times: number[] = []
  for (const e of entries) {
    const t = timelineTime(e)
    if (t !== undefined) times.push(t)
  }
  if (times.length < 2) return []
  const gaps = times.slice(1).map((t, i) => t - times[i]!)
  let threshold = QUIET_MIN_MS
  if (gaps.length >= MIN_GAPS_FOR_MEDIAN) {
    const sorted = [...gaps].sort((a, b) => a - b)
    threshold = Math.max(QUIET_MIN_MS, sorted[Math.floor(sorted.length / 2)]! * QUIET_FACTOR)
  }
  const out: Mark[] = []
  gaps.forEach((gap, i) => {
    if (gap > threshold) out.push({ kind: 'quiet', time: times[i]!, from: times[i]!, to: times[i + 1]! })
  })
  return out
}

/** Opens a reconnect mark when the stream starts reconnecting and closes it when it is live again. */
export function trackReconnect(marks: readonly Mark[], status: StreamStatus, now: number, lastLineTime: number | undefined): Mark[] {
  const open = marks.findIndex((m) => m.kind === 'reconnect' && m.backAt === undefined)
  if (status.state === 'reconnecting') {
    if (open >= 0 || lastLineTime === undefined) return [...marks]
    return [...marks, { kind: 'reconnect', time: lastLineTime, lostAt: now }]
  }
  if (status.state === 'live' && open >= 0) {
    return marks.map((m, i) => (i === open ? { ...m, backAt: now } : m))
  }
  return [...marks]
}

export function restartMarks(container: string, runs: readonly TerminatedRun[]): Mark[] {
  const out: Mark[] = []
  for (const r of runs) {
    if (r.finishedAt === undefined) continue
    const m: Mark = { kind: 'restart', time: r.finishedAt, container }
    if (r.reason) m.reason = r.reason
    if (r.exitCode !== undefined) m.exitCode = r.exitCode
    if (r.startedAt !== undefined) m.ranMs = r.finishedAt - r.startedAt
    out.push(m)
  }
  return out
}

/** Normal events worth showing; the rest of Normal (Scheduled, Pulled, Created, Started) is routine. */
const NOTABLE_NORMAL = new Set(['Killing'])

/** Warnings and notable events about the pod or the tab's container. */
export function eventMarks(events: readonly PodEvent[], container: string | undefined): Mark[] {
  const out: Mark[] = []
  for (const e of events) {
    if (e.type !== 'Warning' && !NOTABLE_NORMAL.has(e.reason)) continue
    if (e.container && container && e.container !== container) continue
    const m: Mark = { kind: 'event', time: e.lastTime, type: e.type, reason: e.reason, message: e.message, count: e.count }
    if (e.firstTime !== undefined && e.count > 1) m.firstTime = e.firstTime
    out.push(m)
  }
  return out
}

export interface PlacedMarks {
  /** Row index → marks shown right above that row. */
  before: Map<number, Mark[]>
  /** Marks after the last row (still happening, or nothing logged since). */
  trailing: Mark[]
}

/** Puts each mark above the first row that is later than it; drops marks before the first row or outside `range`. */
export function placeMarks(rows: readonly Row[], marks: readonly Mark[], range?: readonly [number, number]): PlacedMarks {
  const before = new Map<number, Mark[]>()
  const timed: Array<[number, number]> = []
  rows.forEach((r, i) => {
    const t = timelineTime(r.entry)
    if (t !== undefined) timed.push([i, t])
  })
  if (timed.length === 0) return { before, trailing: [] }
  const first = timed[0]![1]
  const pending = marks
    .filter((m) => m.time >= first && (!range || (m.time >= range[0] && m.time <= range[1])))
    .sort((a, b) => a.time - b.time)
  let j = 0
  for (const [i, t] of timed) {
    while (j < pending.length && pending[j]!.time < t) {
      const list = before.get(i) ?? []
      list.push(pending[j++]!)
      before.set(i, list)
    }
  }
  return { before, trailing: pending.slice(j) }
}
