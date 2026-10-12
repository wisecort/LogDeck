import { fractionToMs, monthIndex, utcTime } from '../time'
import type { Level, LineParser } from '../types'

const LEVELS: Readonly<Record<string, Level>> = {
  DEBUG: 'DEBUG',
  NOTICE: 'INFO',
  WARNING: 'WARN',
  ERROR: 'ERROR',
  ALERT: 'FATAL',
}

// [09-Oct-2026 03:26:40] WARNING: [pool www] message
const LINE = /^\[(\d{2})-(\w{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?\] ([A-Z]+): (.*)$/

export const phpFpmParser: LineParser = {
  id: 'php-fpm',
  detect: (line) => /^\[\d{2}-\w{3}-\d{4} \d{2}:\d{2}:\d{2}(?:\.\d+)?\] [A-Z]+:/.test(line),
  parse(line) {
    const m = LINE.exec(line)
    if (!m) return null
    const level = LEVELS[m[8]!]
    if (!level) return null
    const month = monthIndex(m[2]!)
    const time = month === undefined ? undefined : utcTime(+m[3]!, month, +m[1]!, +m[4]!, +m[5]!, +m[6]!, fractionToMs(m[7]))
    const message = m[9]!
    const pool = /\[pool ([\w.-]+)\]/.exec(message)
    return pool ? { level, time, message, fields: { pool: pool[1]! } } : { level, time, message }
  },
}
