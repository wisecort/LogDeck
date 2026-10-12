import { parseIsoTime } from '../time'
import type { Level, LineParser } from '../types'

const LEVELS: Readonly<Record<string, Level>> = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  NOTICE: 'INFO',
  WARNING: 'WARN',
  ERROR: 'ERROR',
  CRITICAL: 'FATAL',
  ALERT: 'FATAL',
  EMERGENCY: 'FATAL',
}

// [2026-10-09 03:26:40] production.ERROR: message
const LINE = /^\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\] ([\w-]+)\.([A-Z]+): ?(.*)$/

export const laravelParser: LineParser = {
  id: 'laravel',
  detect: (line) => /^\[\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\]]*\] [\w-]+\.[A-Z]+:/.test(line),
  parse(line) {
    const m = LINE.exec(line)
    if (!m) return null
    const level = LEVELS[m[3]!]
    if (!level) return null
    return { level, time: parseIsoTime(m[1]!), message: m[4]!, fields: { env: m[2]! } }
  },
}
