import { stripAnsi } from './ansi'
import { parseLine } from './parsers'
import { fractionToMs, utcTime } from './time'
import type { Level, LogEntry } from './types'

/** Log time and k8s time further apart than this are both shown (P2). */
export const DIVERGENCE_MS = 2000

// RFC3339Nano as printed by `kubectl logs --timestamps` (trailing zeros trimmed).
const K8S_TS = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z(?: |$)/

export function splitK8sTimestamp(line: string): { k8sTime?: number; rest: string } {
  const m = K8S_TS.exec(line)
  if (!m) return { rest: line }
  const k8sTime = utcTime(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!, fractionToMs(m[7]))
  if (k8sTime === undefined) return { rest: line }
  return { k8sTime, rest: line.slice(m[0].length) }
}

const CONTINUATION = [
  /^[ \t]+\S/, // indented (Java "\tat ...", Node "    at ...", "\t... 12 more")
  /^#\d+ /, // PHP stack frame
  /^at /,
  /^Caused by: /,
  /^Stack trace:/,
  /^Next /,
  /^\.\.\. \d+ more/,
  /^\[stacktrace\]$/, // Laravel
  /^"\}\s*$/, // end of Laravel exception context
  /^(?:[a-zA-Z_$][\w$]*\.)+[A-Z][\w$]*(?:Exception|Error|Throwable)(?::|$)/, // Java exception class line
]

/** True for stack-trace style lines that belong to the previous entry. */
export function isContinuation(rest: string): boolean {
  return CONTINUATION.some((re) => re.test(rest))
}

export type AssembleEvent =
  | { type: 'entry'; entry: LogEntry }
  | { type: 'continuation'; seq: number; text: string }

export interface AssembleOptions {
  now?: () => number
  startSeq?: number
  /** Level for lines no parser recognizes (INFO for OKD build pods, whose RUN output has no format). */
  defaultLevel?: Level
}

/** Streaming line → entry assembler (parsing, timestamps, multiline). */
export class LogAssembler {
  private nextSeq: number
  private lastSeq: number | undefined
  private readonly now: () => number
  private readonly defaultLevel: Level

  constructor(opts: AssembleOptions = {}) {
    this.nextSeq = opts.startSeq ?? 1
    this.now = opts.now ?? Date.now
    this.defaultLevel = opts.defaultLevel ?? 'UNKNOWN'
  }

  push(rawLine: string): AssembleEvent {
    const split = splitK8sTimestamp(rawLine)
    const k8sTime = split.k8sTime
    const rest = stripAnsi(split.rest)
    if (this.lastSeq !== undefined && isContinuation(rest)) {
      return { type: 'continuation', seq: this.lastSeq, text: rest }
    }
    const parsed = parseLine(rest)
    const entry: LogEntry = {
      seq: this.nextSeq++,
      raw: rest,
      message: parsed.message,
      level: parsed.level ?? this.defaultLevel,
      parser: parsed.parser,
      ingestTime: this.now(),
      continuation: [],
    }
    if (k8sTime !== undefined) entry.k8sTime = k8sTime
    if (parsed.time !== undefined) entry.logTime = parsed.time
    if (parsed.fields) entry.fields = parsed.fields
    this.lastSeq = entry.seq
    return { type: 'entry', entry }
  }
}

export function assemble(lines: readonly string[], opts: AssembleOptions = {}): LogEntry[] {
  const assembler = new LogAssembler(opts)
  const entries: LogEntry[] = []
  for (const line of lines) {
    const event = assembler.push(line)
    if (event.type === 'entry') entries.push(event.entry)
    else entries[entries.length - 1]!.continuation.push(event.text)
  }
  return entries
}

export interface DisplayTime {
  time?: number
  source: 'log' | 'k8s' | 'none'
  divergent: boolean
}

/** Log time first, k8s time as fallback; the ingestion time is never shown (P2). */
export function displayTime(entry: Pick<LogEntry, 'k8sTime' | 'logTime' | 'ingestTime'>): DisplayTime {
  if (entry.logTime !== undefined) {
    const divergent = entry.k8sTime !== undefined && Math.abs(entry.logTime - entry.k8sTime) > DIVERGENCE_MS
    return { time: entry.logTime, source: 'log', divergent }
  }
  if (entry.k8sTime !== undefined) return { time: entry.k8sTime, source: 'k8s', divergent: false }
  return { time: undefined, source: 'none', divergent: false }
}

/**
 * One clock for timelines (histogram, time-range filter, error groups): kubectl's --timestamps
 * when present, because log times may lack a time zone (Laravel in UTC-3, P2).
 */
export function timelineTime(entry: Pick<LogEntry, 'k8sTime' | 'logTime'>): number | undefined {
  return entry.k8sTime ?? entry.logTime
}
