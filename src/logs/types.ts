export const LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'UNKNOWN'] as const

export type Level = (typeof LEVELS)[number]

/** Result of a single-line parser. Times are epoch milliseconds (UTC). */
export interface ParsedLine {
  level?: Level
  time?: number
  message: string
  fields?: Record<string, unknown>
}

export interface LineParser {
  readonly id: string
  /** Cheap check; `parse` may still return null for malformed/truncated lines. */
  detect(line: string): boolean
  parse(line: string): ParsedLine | null
}

export interface LogEntry {
  /** Monotonic sequence number, unique per stream. */
  seq: number
  /** First line without the `--timestamps` prefix. */
  raw: string
  message: string
  level: Level
  /** Id of the parser that recognised the line, or 'none'. */
  parser: string
  /** Time from the kubectl `--timestamps` prefix. */
  k8sTime?: number
  /** Time extracted from the log line itself. */
  logTime?: number
  /** When LogDeck received the line. Never shown as the log time (P2). */
  ingestTime: number
  /** Stack-trace lines glued to this entry. */
  continuation: string[]
  fields?: Record<string, unknown>
}
