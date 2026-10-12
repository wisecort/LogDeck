// Timestamp helpers shared by the parsers. Times without an offset are taken as UTC,
// which is the default inside containers.

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
}

export function monthIndex(name: string): number | undefined {
  return MONTHS[name]
}

/** Milliseconds from a fractional-seconds string of any length ("1" → 100, "123456" → 123). */
export function fractionToMs(fraction: string | undefined): number {
  return fraction ? Number((fraction + '00').slice(0, 3)) : 0
}

/** "+0000", "-03:00", "Z" → offset in minutes. */
export function offsetMinutes(offset: string | undefined): number {
  if (!offset || offset === 'Z') return 0
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(offset)
  if (!m) return 0
  const minutes = Number(m[2]) * 60 + Number(m[3])
  return m[1] === '-' ? -minutes : minutes
}

/** Builds an epoch-ms time and rejects impossible dates (e.g. month 13). */
export function utcTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms = 0,
  offset = 0,
): number | undefined {
  const t = Date.UTC(year, month, day, hour, minute, second, ms)
  const d = new Date(t)
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month ||
    d.getUTCDate() !== day ||
    d.getUTCHours() !== hour ||
    d.getUTCMinutes() !== minute ||
    d.getUTCSeconds() !== second
  ) {
    return undefined
  }
  return t - offset * 60_000
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:[.,](\d+))?\s*(Z|[+-]\d{2}:?\d{2})?$/

/** ISO-8601-ish timestamp (space or T, optional fraction and offset). */
export function parseIsoTime(text: string): number | undefined {
  const m = ISO.exec(text.trim())
  if (!m) return undefined
  return utcTime(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!, fractionToMs(m[7]), offsetMinutes(m[8]))
}
