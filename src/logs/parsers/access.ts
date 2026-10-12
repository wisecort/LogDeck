import { monthIndex, offsetMinutes, utcTime } from '../time'
import type { Level, LineParser } from '../types'

// Apache/nginx "common" and "combined" formats; extra trailing fields are ignored.
const LINE =
  /^(\S+) (\S+) (\S+) \[(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})\] "(\S+) (\S+) (HTTP\/[\d.]+)" (\d{3}) (\d+|-)(?: "((?:[^"\\]|\\.)*)" "((?:[^"\\]|\\.)*)")?/

function levelOf(status: number): Level {
  if (status >= 500) return 'ERROR'
  if (status >= 400) return 'WARN'
  return 'INFO'
}

export const accessParser: LineParser = {
  id: 'access',
  detect: (line) => /\[\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4}\] "\S+ /.test(line),
  parse(line) {
    const m = LINE.exec(line)
    if (!m) return null
    const month = monthIndex(m[5]!)
    const time = month === undefined ? undefined : utcTime(+m[6]!, month, +m[4]!, +m[7]!, +m[8]!, +m[9]!, 0, offsetMinutes(m[10]))
    const status = Number(m[14])
    const fields: Record<string, unknown> = {
      remoteAddr: m[1],
      user: m[3],
      method: m[11],
      path: m[12],
      protocol: m[13],
      status,
      bytes: m[15] === '-' ? 0 : Number(m[15]),
    }
    if (m[16] !== undefined) fields['referer'] = m[16]
    if (m[17] !== undefined) fields['userAgent'] = m[17]
    return { level: levelOf(status), time, message: `${m[11]} ${m[12]} ${status}`, fields }
  },
}
