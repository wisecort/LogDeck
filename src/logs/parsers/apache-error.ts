import { fractionToMs, monthIndex, utcTime } from '../time'
import type { Level, LineParser } from '../types'
import { SYSLOG_LEVELS } from './levels'

const DATE = String.raw`\[\w{3} (\w{3}) (\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d+))? (\d{4})\]`
// 2.4: [date] [module:level] ...   2.2: [date] [level] ...   stderr: [module:level] ...
const WITH_DATE = new RegExp(`^${DATE} \\[(?:([\\w-]+):)?(\\w+)\\](.*)$`)
const NO_DATE = /^\[([\w-]+):(\w+)\](.*)$/
const LEVEL_WORD = String.raw`(?:trace[1-8]|debug|info|notice|warn|error|crit|alert|emerg)`

function levelOf(word: string): Level | undefined {
  return /^trace[1-8]$/.test(word) ? 'TRACE' : SYSLOG_LEVELS[word]
}

export const apacheErrorParser: LineParser = {
  id: 'apache-error',
  detect: (line) =>
    new RegExp(`^${DATE} \\[(?:[\\w-]+:)?\\w+\\]`).test(line) || new RegExp(`^\\[[\\w-]+:${LEVEL_WORD}\\]`).test(line),
  parse(line) {
    let time: number | undefined
    let module: string | undefined
    let word: string
    let rest: string
    const d = WITH_DATE.exec(line)
    if (d) {
      const month = monthIndex(d[1]!)
      time = month === undefined ? undefined : utcTime(+d[7]!, month, +d[2]!, +d[3]!, +d[4]!, +d[5]!, fractionToMs(d[6]))
      module = d[8]
      word = d[9]!
      rest = d[10]!
    } else {
      const n = NO_DATE.exec(line)
      if (!n) return null
      module = n[1]
      word = n[2]!
      rest = n[3]!
    }
    const level = levelOf(word)
    if (!level) return null
    const fields: Record<string, unknown> = {}
    if (module) fields['module'] = module
    const pid = /^\s*\[pid (\d+)[^\]]*\]/.exec(rest)
    if (pid) fields['pid'] = Number(pid[1])
    const message = rest.replace(/^\s*\[pid [^\]]*\]/, '').trim()
    return { level, time, message, fields }
  },
}
