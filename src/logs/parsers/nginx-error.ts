import { utcTime } from '../time'
import type { LineParser } from '../types'
import { SYSLOG_LEVELS } from './levels'

// 2026/10/09 03:26:40 [error] 12#12: *1 message
const LINE = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2}) \[(\w+)\] (\d+)#\d+: (.*)$/

export const nginxErrorParser: LineParser = {
  id: 'nginx-error',
  detect: (line) => /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2} \[\w+\]/.test(line),
  parse(line) {
    const m = LINE.exec(line)
    if (!m) return null
    const level = SYSLOG_LEVELS[m[7]!]
    if (!level) return null
    return {
      level,
      time: utcTime(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!),
      message: m[9]!,
      fields: { pid: Number(m[8]) },
    }
  },
}
