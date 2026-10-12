import { parseIsoTime } from '../time'
import type { Level, LineParser } from '../types'

const TOKEN = /\b(TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL)\b/
const TOKEN_LEVEL: Readonly<Record<string, Level>> = {
  TRACE: 'TRACE',
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  WARNING: 'WARN',
  ERROR: 'ERROR',
  FATAL: 'FATAL',
}

const KEYWORDS: ReadonlyArray<[RegExp, Level]> = [
  [/\b(?:fatal|panic)\b/i, 'FATAL'],
  [/\b(?:error|exception|failed|failure)\b|permission denied|not permitted/i, 'ERROR'],
  [/\b(?:warn|warning|timeout|timed out|deprecated)\b/i, 'WARN'],
]

const LEADING_TIME = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/

/** Last resort: explicit level token first, then keywords. */
export const heuristicParser: LineParser = {
  id: 'heuristic',
  detect: () => true,
  parse(line) {
    const token = TOKEN.exec(line)
    const level = token ? TOKEN_LEVEL[token[1]!] : KEYWORDS.find(([re]) => re.test(line))?.[1]
    const ts = LEADING_TIME.exec(line)
    return { level, time: ts ? parseIsoTime(ts[1]!) : undefined, message: line }
  },
}
