import { todo } from '../shared/todo'
import type { Level, LogEntry } from './types'

export const DEFAULT_CAPACITY = 50_000
export const MAX_CAPACITY = 500_000

/** Fixed-size ring buffer of entries; drops the oldest when full (RNF2, RNF6). */
export class LogBuffer {
  readonly capacity: number

  constructor(opts: { capacity?: number } = {}) {
    this.capacity = opts.capacity ?? DEFAULT_CAPACITY
    todo(opts)
  }

  get size(): number {
    return todo()
  }

  /** Entries discarded because the buffer was full. */
  get dropped(): number {
    return todo()
  }

  get counts(): Readonly<Record<Level, number>> {
    return todo()
  }

  push(entry: LogEntry): void {
    todo(entry)
  }

  pushMany(entries: readonly LogEntry[]): void {
    todo(entries)
  }

  /** Appends a stack-trace line; false if the entry was already dropped. */
  appendContinuation(seq: number, text: string): boolean {
    return todo(seq, text)
  }

  /** 0 is the oldest entry still in the buffer. */
  at(index: number): LogEntry | undefined {
    return todo(index)
  }

  bySeq(seq: number): LogEntry | undefined {
    return todo(seq)
  }

  toArray(): LogEntry[] {
    return todo()
  }

  clear(): void {
    todo()
  }
}
