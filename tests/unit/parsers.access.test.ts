import { describe, expect, it } from 'vitest'
import { accessParser } from '../../src/logs/parsers/access'

const HEALTH =
  '10.0.0.2 - - [09/Oct/2026:03:26:40 +0000] "GET / HTTP/1.1" 200 19340 "-" "dashboard-okd (checagem de disponibilidade)"'

describe('apache/nginx access parser', () => {
  it('detects combined and common formats', () => {
    expect(accessParser.detect(HEALTH)).toBe(true)
    expect(accessParser.detect('10.0.0.4 - - [09/Oct/2026:03:26:47 +0000] "GET /index.php HTTP/1.0" 302 0')).toBe(true)
    expect(accessParser.detect('[proxy_fcgi:error] something')).toBe(false)
  })

  it('parses the health-check line from P1 as INFO with fields', () => {
    expect(accessParser.parse(HEALTH)).toEqual({
      level: 'INFO',
      time: Date.parse('2026-10-09T03:26:40Z'),
      message: 'GET / 200',
      fields: {
        remoteAddr: '10.0.0.2',
        user: '-',
        method: 'GET',
        path: '/',
        protocol: 'HTTP/1.1',
        status: 200,
        bytes: 19340,
        referer: '-',
        userAgent: 'dashboard-okd (checagem de disponibilidade)',
      },
    })
  })

  it.each([
    [101, 'INFO'],
    [200, 'INFO'],
    [302, 'INFO'],
    [304, 'INFO'],
    [400, 'WARN'],
    [404, 'WARN'],
    [499, 'WARN'],
    [500, 'ERROR'],
    [503, 'ERROR'],
    [504, 'ERROR'],
  ])('maps status %i to %s', (status, level) => {
    const line = `10.0.0.15 - - [09/Oct/2026:03:26:42 +0000] "POST /api HTTP/1.1" ${status} 247 "-" "Mozilla/5.0"`
    expect(accessParser.parse(line)?.level).toBe(level)
  })

  it('converts the time zone offset to UTC', () => {
    const r = accessParser.parse('10.0.0.15 - admin [09/Oct/2026:03:26:46 -0300] "DELETE /api/v1/cache HTTP/1.1" 500 512 "-" "curl/8.7.1"')
    expect(r?.time).toBe(Date.parse('2026-10-09T06:26:46Z'))
    expect(r?.fields?.['user']).toBe('admin')
  })

  it('handles "-" byte count and the common format without referer/agent', () => {
    expect(accessParser.parse('10.0.0.16 - - [09/Oct/2026:03:26:44 +0000] "GET /a.js HTTP/1.1" 304 - "-" "Mozilla/5.0"')?.fields?.['bytes']).toBe(0)
    const common = accessParser.parse('10.0.0.4 - - [09/Oct/2026:03:26:47 +0000] "GET /index.php HTTP/1.0" 302 0')
    expect(common?.fields?.['userAgent']).toBeUndefined()
    expect(common?.level).toBe('INFO')
  })

  it('handles OPTIONS * and query strings', () => {
    expect(accessParser.parse('10.0.0.21 - - [09/Oct/2026:03:26:48 +0000] "OPTIONS * HTTP/1.0" 200 126 "-" "Apache"')?.message).toBe('OPTIONS * 200')
    expect(
      accessParser.parse('10.0.0.22 - - [09/Oct/2026:03:26:49 +0000] "GET /api?page=2&q=a%20b HTTP/2.0" 503 0 "-" "x"')?.fields?.['path'],
    ).toBe('/api?page=2&q=a%20b')
  })

  it('returns null for a truncated line', () => {
    expect(accessParser.parse('10.0.0.2 - - [09/Oct/2026:03:26:40 +0000] "GET / HTT')).toBeNull()
  })
})
