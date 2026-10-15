import { LEVELS, type Level, type LogEntry } from './types'

export const DEFAULT_CAPACITY = 50_000
export const MAX_CAPACITY = 500_000

function zeroCounts(): Record<Level, number> {
  return Object.fromEntries(LEVELS.map((l) => [l, 0])) as Record<Level, number>
}

/**
 * Fixed-size ring buffer of entries; drops the oldest when full (RNF2, RNF6).
 * `capacity: Infinity` keeps everything (a local file: it has a fixed size, nothing to drop).
 */
export class LogBuffer {
  readonly capacity: number
  private ring: Array<LogEntry | undefined>
  private head = 0
  private length = 0
  private droppedCount = 0
  private levelCounts = zeroCounts()
  private readonly index = new Map<number, LogEntry>()

  constructor(opts: { capacity?: number } = {}) {
    const capacity = opts.capacity ?? DEFAULT_CAPACITY
    if (capacity !== Infinity && (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CAPACITY)) {
      throw new RangeError(`capacity must be an integer between 1 and ${MAX_CAPACITY}, got ${capacity}`)
    }
    this.capacity = capacity
    this.ring = this.emptyRing()
  }

  get size(): number {
    return this.length
  }

  /** Entries discarded because the buffer was full. */
  get dropped(): number {
    return this.droppedCount
  }

  get counts(): Readonly<Record<Level, number>> {
    return { ...this.levelCounts }
  }

  push(entry: LogEntry): void {
    if (this.length === this.capacity) {
      const oldest = this.ring[this.head]!
      this.levelCounts[oldest.level]--
      this.index.delete(oldest.seq)
      this.ring[this.head] = entry
      this.head = (this.head + 1) % this.capacity
      this.droppedCount++
    } else {
      this.ring[(this.head + this.length) % this.capacity] = entry
      this.length++
    }
    this.levelCounts[entry.level]++
    this.index.set(entry.seq, entry)
  }

  pushMany(entries: readonly LogEntry[]): void {
    for (const entry of entries) this.push(entry)
  }

  /** Appends a stack-trace line; false if the entry was already dropped. */
  appendContinuation(seq: number, text: string): boolean {
    const entry = this.index.get(seq)
    if (!entry) return false
    entry.continuation.push(text)
    return true
  }

  /** 0 is the oldest entry still in the buffer. */
  at(index: number): LogEntry | undefined {
    if (index < 0 || index >= this.length) return undefined
    return this.ring[(this.head + index) % this.capacity]
  }

  bySeq(seq: number): LogEntry | undefined {
    return this.index.get(seq)
  }

  toArray(): LogEntry[] {
    const out = new Array<LogEntry>(this.length)
    for (let i = 0; i < this.length; i++) out[i] = this.ring[(this.head + i) % this.capacity]!
    return out
  }

  /** Preallocated for a ring; grows as needed without a limit (x % Infinity === x, so the indexing still holds). */
  private emptyRing(): Array<LogEntry | undefined> {
    return this.capacity === Infinity ? [] : new Array<LogEntry | undefined>(this.capacity)
  }

  clear(): void {
    this.ring = this.emptyRing()
    this.head = 0
    this.length = 0
    this.droppedCount = 0
    this.levelCounts = zeroCounts()
    this.index.clear()
  }
}
