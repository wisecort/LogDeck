import { describe, expect, it } from 'vitest'
import { nginxErrorParser } from '../../src/logs/parsers/nginx-error'

const UPSTREAM =
  '2026/10/09 03:26:40 [error] 12#12: *1 upstream timed out (110: Connection timed out) while reading response header from upstream, client: 10.0.0.2'

describe('nginx error parser', () => {
  it('detects the nginx header', () => {
    expect(nginxErrorParser.detect(UPSTREAM)).toBe(true)
    expect(nginxErrorParser.detect('2026-10-09 03:26:40.123 ERROR 1 --- [main] x')).toBe(false)
  })

  it('parses level, time, pid and message', () => {
    expect(nginxErrorParser.parse(UPSTREAM)).toEqual({
      level: 'ERROR',
      time: Date.parse('2026-10-09T03:26:40Z'),
      message: '*1 upstream timed out (110: Connection timed out) while reading response header from upstream, client: 10.0.0.2',
      fields: { pid: 12 },
    })
  })

  it.each([
    ['debug', 'DEBUG'],
    ['info', 'INFO'],
    ['notice', 'INFO'],
    ['warn', 'WARN'],
    ['error', 'ERROR'],
    ['crit', 'FATAL'],
    ['alert', 'FATAL'],
    ['emerg', 'FATAL'],
  ])('maps %s to %s', (level, expected) => {
    expect(nginxErrorParser.parse(`2026/10/09 03:26:40 [${level}] 1#1: m`)?.level).toBe(expected)
  })

  it('returns null for a truncated header', () => {
    expect(nginxErrorParser.parse('2026/10/09 03:26:40 [err')).toBeNull()
  })
})
