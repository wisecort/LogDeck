import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Level, LogEntry } from '../../src/logs/types'
import { FIXTURES } from './fake-kubectl'

export function fixtureLines(name: string): string[] {
  return readFileSync(join(FIXTURES, name), 'utf8').split('\n').filter((l) => l.length > 0)
}

/** Top-level tests/fixtures/*.log (the UNKNOWN < 5% corpus). */
export function fixtureLogFiles(): string[] {
  return readdirSync(FIXTURES).filter((f) => f.endsWith('.log'))
}

let seq = 0
export function entry(partial: Partial<LogEntry> & { level?: Level } = {}): LogEntry {
  seq++
  return {
    seq,
    raw: partial.raw ?? `line ${seq}`,
    message: partial.message ?? partial.raw ?? `line ${seq}`,
    level: 'INFO',
    parser: 'none',
    ingestTime: 0,
    continuation: [],
    ...partial,
  }
}
