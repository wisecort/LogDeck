import { todo } from '../shared/todo'
import type { Level, LogEntry } from './types'

export interface SearchSpec {
  text: string
  mode?: 'text' | 'regex'
  caseSensitive?: boolean
  /** Plain-text terms; entries containing any of them are hidden. */
  exclude?: readonly string[]
}

export interface CompiledSearch {
  ok: true
  matches(text: string): boolean
  excluded(text: string): boolean
  /** [start, end) ranges of every match, for highlighting. */
  ranges(text: string): Array<[number, number]>
}

export type CompileResult = CompiledSearch | { ok: false; error: 'invalid' | 'unsafe'; message: string }

export function compileSearch(spec: SearchSpec): CompileResult {
  return todo(spec)
}

/** Static check for catastrophic-backtracking shapes such as `(a+)+`. */
export function isUnsafeRegex(pattern: string): boolean {
  return todo(pattern)
}

/** Text that search applies to: first line plus continuation lines. */
export function entryText(entry: Pick<LogEntry, 'raw' | 'continuation'>): string {
  return todo(entry)
}

export function filterEntries(
  entries: readonly LogEntry[],
  opts: { search?: CompiledSearch; levels?: ReadonlySet<Level> },
): LogEntry[] {
  return todo(entries, opts)
}

export interface Segment {
  text: string
  match: boolean
}

export function highlight(text: string, search: CompiledSearch): Segment[] {
  return todo(text, search)
}

export type SearchOutcome =
  | { status: 'ok'; matches: number[] }
  | { status: 'timeout' }
  | { status: 'invalid' | 'unsafe'; message: string }

/** Runs the search in a disposable worker and gives up after `timeoutMs` (F5.4). */
export function searchWithTimeout(
  texts: readonly string[],
  spec: SearchSpec,
  opts: { timeoutMs?: number } = {},
): Promise<SearchOutcome> {
  return todo(texts, spec, opts)
}
