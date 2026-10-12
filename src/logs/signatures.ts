import { todo } from '../shared/todo'
import type { LogEntry } from './types'

export interface SignatureMatch {
  id: string
  title: string
}

export interface SignatureGroup extends SignatureMatch {
  /** `id` for catalog rules, `generic:<normalized message>` otherwise. */
  key: string
  count: number
  firstTime?: number
  lastTime?: number
  sample: string
  seqs: number[]
}

/** Catalog rule first, then `generic` for ERROR/FATAL/timeout entries; null otherwise. */
export function matchSignature(entry: LogEntry): SignatureMatch | null {
  return todo(entry)
}

/** Replaces timestamps, IPs, numbers, hex and UUIDs with placeholders. */
export function normalizeMessage(text: string): string {
  return todo(text)
}

export class SignatureIndex {
  add(entry: LogEntry): void {
    todo(entry)
  }

  addMany(entries: readonly LogEntry[]): void {
    todo(entries)
  }

  /** Sorted by count, descending. */
  groups(): SignatureGroup[] {
    return todo()
  }

  clear(): void {
    todo()
  }
}
