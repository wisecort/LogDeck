import { parseIsoTime } from '../time'
import type { Level, LineParser } from '../types'
import { levelFromName } from './levels'

const LEVEL_KEYS = ['level_name', 'severity', 'level', 'lvl'] as const
const TIME_KEYS = ['datetime', 'time', 'ts', 'timestamp', '@timestamp', 't'] as const
const MESSAGE_KEYS = ['msg', 'message'] as const

/** Monolog uses 100–600, pino uses 10–60. */
function levelFromNumber(n: number): Level {
  if (n >= 100) {
    if (n < 200) return 'DEBUG'
    if (n < 300) return 'INFO'
    if (n < 400) return 'WARN'
    if (n < 500) return 'ERROR'
    return 'FATAL'
  }
  if (n <= 10) return 'TRACE'
  if (n <= 20) return 'DEBUG'
  if (n <= 30) return 'INFO'
  if (n <= 40) return 'WARN'
  if (n <= 50) return 'ERROR'
  return 'FATAL'
}

function levelOf(obj: Record<string, unknown>): Level | undefined {
  for (const key of LEVEL_KEYS) {
    const v = obj[key]
    if (typeof v === 'string') return levelFromName(v)
    if (typeof v === 'number') return levelFromNumber(v)
  }
  return undefined
}

function timeOf(obj: Record<string, unknown>): number | undefined {
  for (const key of TIME_KEYS) {
    const v = obj[key]
    // Epoch milliseconds (pino) vs epoch seconds with fraction (zap).
    if (typeof v === 'number') return v > 1e12 ? v : Math.round(v * 1000)
    if (typeof v === 'string') return parseIsoTime(v)
  }
  return undefined
}

export const jsonParser: LineParser = {
  id: 'json',
  detect: (line) => line.trimStart().startsWith('{'),
  parse(line) {
    let obj: unknown
    try {
      obj = JSON.parse(line)
    } catch {
      return null
    }
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null
    const rec = obj as Record<string, unknown>
    const msgKey = MESSAGE_KEYS.find((k) => typeof rec[k] === 'string')
    return {
      level: levelOf(rec),
      time: timeOf(rec),
      message: msgKey ? (rec[msgKey] as string) : line,
    }
  },
}
