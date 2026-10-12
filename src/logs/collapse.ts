import { displayTime } from './classify'
import { stripTimestamps } from './signatures'
import type { LogEntry } from './types'

export interface Row {
  /** Latest entry of the run; shown in the list. */
  entry: LogEntry
  /** Number of consecutive identical entries (×N). */
  count: number
  firstTime?: number
  lastTime?: number
}

function key(entry: LogEntry): string {
  const base = `${entry.level}\u0000${stripTimestamps(entry.raw)}`
  return entry.continuation.length === 0 ? base : `${base}\u0000${entry.continuation.join('\n')}`
}

/** Collapses consecutive entries with the same level and text, ignoring timestamps (P3). */
export function collapseRows(entries: readonly LogEntry[]): Row[] {
  const rows: Row[] = []
  let lastKey: string | undefined
  for (const entry of entries) {
    const k = key(entry)
    const time = displayTime(entry).time
    const prev = rows[rows.length - 1]
    if (prev && k === lastKey) {
      prev.entry = entry
      prev.count++
      if (time !== undefined) {
        prev.firstTime ??= time
        prev.lastTime = time
      }
      continue
    }
    const row: Row = { entry, count: 1 }
    if (time !== undefined) {
      row.firstTime = time
      row.lastTime = time
    }
    rows.push(row)
    lastKey = k
  }
  return rows
}
