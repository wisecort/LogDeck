// Log volume histogram (block D): counts per level in equal time buckets.
import { timelineTime } from '../logs/classify'
import { LEVELS, type Level, type LogEntry } from '../logs/types'

export interface VolumeBucket {
  from: number
  counts: Record<Level, number>
  total: number
}

export interface Volume {
  start: number
  end: number
  bucketMs: number
  max: number
  buckets: VolumeBucket[]
}

const zero = () => Object.fromEntries(LEVELS.map((l) => [l, 0])) as Record<Level, number>

export function buildVolume(entries: readonly LogEntry[], bucketCount: number): Volume {
  const timed: Array<[number, Level]> = []
  for (const e of entries) {
    const t = timelineTime(e)
    if (t !== undefined) timed.push([t, e.level])
  }
  if (timed.length === 0) return { start: 0, end: 0, bucketMs: 0, max: 0, buckets: [] }
  let start = Infinity
  let end = -Infinity
  for (const [t] of timed) {
    if (t < start) start = t
    if (t > end) end = t
  }
  const bucketMs = Math.max(1, Math.ceil((end - start + 1) / bucketCount))
  const buckets: VolumeBucket[] = Array.from({ length: bucketCount }, (_, i) => ({ from: start + i * bucketMs, counts: zero(), total: 0 }))
  for (const [t, level] of timed) {
    const b = buckets[Math.min(bucketCount - 1, Math.floor((t - start) / bucketMs))]!
    b.counts[level]++
    b.total++
  }
  return { start, end, bucketMs, max: Math.max(...buckets.map((b) => b.total)), buckets }
}
