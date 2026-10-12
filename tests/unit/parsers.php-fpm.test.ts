import { describe, expect, it } from 'vitest'
import { phpFpmParser } from '../../src/logs/parsers/php-fpm'

describe('php-fpm parser', () => {
  it('detects the FPM header', () => {
    expect(phpFpmParser.detect('[09-Oct-2026 03:26:40] WARNING: [pool www] server reached pm.max_children')).toBe(true)
    expect(phpFpmParser.detect('[09-Oct-2026 03:26:45.123456] NOTICE: x')).toBe(true)
    expect(phpFpmParser.detect('[2026-10-09 03:26:40] production.ERROR: x')).toBe(false)
  })

  it('parses level, time, pool and message', () => {
    expect(phpFpmParser.parse('[09-Oct-2026 03:26:40] WARNING: [pool www] server reached pm.max_children setting (5), consider raising it')).toEqual({
      level: 'WARN',
      time: Date.parse('2026-10-09T03:26:40Z'),
      message: '[pool www] server reached pm.max_children setting (5), consider raising it',
      fields: { pool: 'www' },
    })
  })

  it.each([
    ['DEBUG', 'DEBUG'],
    ['NOTICE', 'INFO'],
    ['WARNING', 'WARN'],
    ['ERROR', 'ERROR'],
    ['ALERT', 'FATAL'],
  ])('maps %s to %s', (level, expected) => {
    expect(phpFpmParser.parse(`[09-Oct-2026 03:26:40] ${level}: m`)?.level).toBe(expected)
  })

  it('parses fractional seconds', () => {
    expect(phpFpmParser.parse('[09-Oct-2026 03:26:45.123456] NOTICE: m')?.time).toBe(Date.parse('2026-10-09T03:26:45.123Z'))
  })

  it('omits pool when absent', () => {
    expect(phpFpmParser.parse('[09-Oct-2026 03:26:38] NOTICE: fpm is running, pid 1')?.fields).toBeUndefined()
  })

  it('returns null for an unknown level or truncated header', () => {
    expect(phpFpmParser.parse('[09-Oct-2026 03:26:40] BOGUS: m')).toBeNull()
    expect(phpFpmParser.parse('[09-Oct-2026 03:26:4')).toBeNull()
  })
})
