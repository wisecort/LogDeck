import { describe, expect, it } from 'vitest'
import { laravelParser } from '../../src/logs/parsers/laravel'

describe('laravel text parser', () => {
  it('detects the Laravel header', () => {
    expect(laravelParser.detect('[2026-10-09 03:26:40] production.ERROR: boom')).toBe(true)
    expect(laravelParser.detect('[2026-10-09T03:26:46.123456+00:00] production.EMERGENCY: x')).toBe(true)
    expect(laravelParser.detect('[09-Oct-2026 03:26:40] WARNING: [pool www]')).toBe(false)
    expect(laravelParser.detect('[2026-10-09 03:26')).toBe(false)
  })

  it('parses level, time and message', () => {
    expect(laravelParser.parse('[2026-10-09 03:26:40] production.ERROR: SQLSTATE[HY000] [2002] Connection timed out')).toEqual({
      level: 'ERROR',
      time: Date.parse('2026-10-09T03:26:40Z'),
      message: 'SQLSTATE[HY000] [2002] Connection timed out',
      fields: { env: 'production' },
    })
  })

  it.each([
    ['DEBUG', 'DEBUG'],
    ['INFO', 'INFO'],
    ['NOTICE', 'INFO'],
    ['WARNING', 'WARN'],
    ['ERROR', 'ERROR'],
    ['CRITICAL', 'FATAL'],
    ['ALERT', 'FATAL'],
    ['EMERGENCY', 'FATAL'],
  ])('maps .%s to %s', (suffix, level) => {
    expect(laravelParser.parse(`[2026-10-09 03:26:40] production.${suffix}: m`)?.level).toBe(level)
  })

  it('parses the ISO-8601 header with offset (Laravel 10+)', () => {
    const r = laravelParser.parse('[2026-10-09T00:26:46.123456-03:00] local-dev.INFO: m')
    expect(r?.time).toBe(Date.parse('2026-10-09T03:26:46.123Z'))
    expect(r?.fields).toEqual({ env: 'local-dev' })
  })

  it('returns null when the header is incomplete', () => {
    expect(laravelParser.parse('[2026-10-09 03:26:40] production')).toBeNull()
  })
})
