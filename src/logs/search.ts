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

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function compileExclusions(terms: readonly string[] = []): (text: string) => boolean {
  const lowered = terms.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0)
  if (lowered.length === 0) return () => false
  return (text) => {
    const l = text.toLowerCase()
    return lowered.some((t) => l.includes(t))
  }
}

function rangesOf(global: RegExp, text: string): Array<[number, number]> {
  const out: Array<[number, number]> = []
  global.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = global.exec(text)) !== null) {
    if (m[0].length === 0) {
      global.lastIndex++
      continue
    }
    out.push([m.index, m.index + m[0].length])
  }
  return out
}

export function compileSearch(spec: SearchSpec): CompileResult {
  const excluded = compileExclusions(spec.exclude)
  const flags = spec.caseSensitive ? 'g' : 'gi'

  if (spec.text === '') {
    return { ok: true, matches: () => true, excluded, ranges: () => [] }
  }

  if (spec.mode === 'regex') {
    if (isUnsafeRegex(spec.text)) {
      return { ok: false, error: 'unsafe', message: 'Regex muito custosa (quantificadores aninhados)' }
    }
    let global: RegExp
    let single: RegExp
    try {
      global = new RegExp(spec.text, flags)
      single = new RegExp(spec.text, flags.replace('g', ''))
    } catch (err) {
      return { ok: false, error: 'invalid', message: (err as Error).message }
    }
    return { ok: true, matches: (t) => single.test(t), excluded, ranges: (t) => rangesOf(global, t) }
  }

  // Plain text: substring search, much faster than a RegExp on 50k lines.
  const needle = spec.caseSensitive ? spec.text : spec.text.toLowerCase()
  const global = new RegExp(escapeRegExp(spec.text), flags)
  const matches = spec.caseSensitive ? (t: string) => t.includes(needle) : (t: string) => t.toLowerCase().includes(needle)
  return { ok: true, matches, excluded, ranges: (t) => rangesOf(global, t) }
}

/** Length of the quantifier at `i` and whether it repeats (+, *, {n,}, {n,m} with m > 1). */
function quantifierAt(pattern: string, i: number): { length: number; repeats: boolean } | null {
  const c = pattern[i]
  if (c === '+' || c === '*') return { length: 1, repeats: true }
  if (c === '?') return { length: 1, repeats: false }
  if (c === '{') {
    const m = /^\{(\d+)(,(\d*))?\}/.exec(pattern.slice(i))
    if (!m) return null
    const repeats = m[2] !== undefined && (m[3] === '' || Number(m[3]) > 1)
    return { length: m[0].length, repeats }
  }
  return null
}

/**
 * Static check for catastrophic-backtracking shapes: a group that contains a
 * repeating quantifier and is itself repeated, e.g. `(a+)+`, `(.*)*`.
 * Shapes it misses are still bounded by `searchWithTimeout`.
 */
export function isUnsafeRegex(pattern: string): boolean {
  const groups: boolean[] = [] // per open group: contains a repeating quantifier?
  let closedGroupRepeats = false // the group just closed contains one
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!
    const q = quantifierAt(pattern, i)
    if (q) {
      if (q.repeats && closedGroupRepeats) return true
      if (q.repeats && groups.length > 0) groups[groups.length - 1] = true
      closedGroupRepeats = false
      i += q.length - 1
      continue
    }
    closedGroupRepeats = false
    if (c === '\\') {
      i++
    } else if (c === '[') {
      i++
      if (pattern[i] === '^') i++
      if (pattern[i] === ']') i++
      while (i < pattern.length && pattern[i] !== ']') {
        if (pattern[i] === '\\') i++
        i++
      }
    } else if (c === '(') {
      groups.push(false)
      if (pattern[i + 1] === '?') {
        // (?:  (?=  (?!  (?<=  (?<!  (?<name>
        const named = /^\(\?<[A-Za-z]\w*>/.exec(pattern.slice(i))
        i += named ? named[0].length - 1 : pattern[i + 2] === '<' ? 3 : 2
      }
    } else if (c === ')') {
      const inner = groups.pop() ?? false
      if (inner && groups.length > 0) groups[groups.length - 1] = true
      closedGroupRepeats = inner
    }
  }
  return false
}

/** Text that search applies to: first line plus continuation lines. */
export function entryText(entry: Pick<LogEntry, 'raw' | 'continuation'>): string {
  return entry.continuation.length === 0 ? entry.raw : `${entry.raw}\n${entry.continuation.join('\n')}`
}

/** How many entries contain any of the exclusion terms (same rule as the exclusion filter). */
export function countExcluded(entries: readonly LogEntry[], terms: readonly string[]): number {
  const excluded = compileExclusions(terms)
  let n = 0
  for (const e of entries) if (excluded(entryText(e))) n++
  return n
}

export function filterEntries(
  entries: readonly LogEntry[],
  opts: { search?: CompiledSearch; levels?: ReadonlySet<Level> },
): LogEntry[] {
  const { search, levels } = opts
  return entries.filter((e) => {
    if (levels && !levels.has(e.level)) return false
    if (!search) return true
    const text = entryText(e)
    return !search.excluded(text) && search.matches(text)
  })
}

export interface Segment {
  text: string
  match: boolean
}

/** Splits text into plain segments; rendering stays text-only (G7). */
export function highlight(text: string, search: CompiledSearch): Segment[] {
  const ranges = search.ranges(text)
  if (ranges.length === 0) return [{ text, match: false }]
  const out: Segment[] = []
  let pos = 0
  for (const [start, end] of ranges) {
    if (start > pos) out.push({ text: text.slice(pos, start), match: false })
    out.push({ text: text.slice(start, end), match: true })
    pos = end
  }
  if (pos < text.length) out.push({ text: text.slice(pos), match: false })
  return out
}

export type SearchOutcome =
  | { status: 'ok'; matches: number[] }
  | { status: 'timeout' }
  | { status: 'invalid' | 'unsafe'; message: string }

/** Runs a regex over texts somewhere it can be killed; resolves null on timeout. */
export type RegexRunner = (
  texts: readonly string[],
  source: string,
  flags: string,
  timeoutMs: number,
) => Promise<number[] | null>

const NODE_WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads')
const re = new RegExp(workerData.source, workerData.flags)
const out = []
workerData.texts.forEach((t, i) => { if (re.test(t)) out.push(i) })
parentPort.postMessage(out)
`

/** The slice of node:worker_threads used here; src/logs also compiles for the browser. */
interface NodeWorker {
  terminate(): Promise<number>
  once(event: 'message', listener: (out: number[]) => void): unknown
  once(event: 'error', listener: (err: Error) => void): unknown
}
type NodeWorkerCtor = new (code: string, opts: { eval: true; workerData: unknown }) => NodeWorker

/** Default runner for Node (main process, tests): a worker_threads worker terminated on timeout. */
const nodeRunner: RegexRunner = async (texts, source, flags, timeoutMs) => {
  // Variable specifier keeps bundlers from pulling a Node builtin into browser code.
  const specifier = 'node:worker_threads'
  const { Worker } = (await import(/* @vite-ignore */ specifier)) as { Worker: NodeWorkerCtor }
  return new Promise((resolve, reject) => {
    const worker = new Worker(NODE_WORKER_SOURCE, { eval: true, workerData: { texts, source, flags } })
    const timer = setTimeout(() => {
      void worker.terminate()
      resolve(null)
    }, timeoutMs)
    worker.once('message', (out: number[]) => {
      clearTimeout(timer)
      void worker.terminate()
      resolve(out)
    })
    worker.once('error', (err: Error) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

/** Runs the search in a disposable worker and gives up after `timeoutMs` (F5.4). */
export async function searchWithTimeout(
  texts: readonly string[],
  spec: SearchSpec,
  opts: { timeoutMs?: number; runner?: RegexRunner } = {},
): Promise<SearchOutcome> {
  const compiled = compileSearch(spec)
  if (!compiled.ok) return { status: compiled.error, message: compiled.message }

  let candidates: number[]
  if (spec.mode === 'regex' && spec.text !== '') {
    const runner = opts.runner ?? nodeRunner
    const flags = spec.caseSensitive ? '' : 'i'
    const out = await runner(texts, spec.text, flags, opts.timeoutMs ?? 250)
    if (out === null) return { status: 'timeout' }
    candidates = out
  } else {
    // Plain text cannot backtrack; no worker needed.
    candidates = texts.flatMap((t, i) => (compiled.matches(t) ? [i] : []))
  }
  return { status: 'ok', matches: candidates.filter((i) => !compiled.excluded(texts[i]!)) }
}
