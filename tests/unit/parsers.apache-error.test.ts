import { describe, expect, it } from 'vitest'
import { apacheErrorParser } from '../../src/logs/parsers/apache-error'

const P4 =
  '[Fri Oct 09 03:26:40.123456 2026] [proxy_fcgi:error] [pid 12:tid 140213] (70007)The timeout specified has expired: [client 10.0.0.2:48660] AH01075: Error dispatching request to : (polling)'

describe('apache error parser', () => {
  it('detects 2.4 [module:level] and 2.2 [level] headers', () => {
    expect(apacheErrorParser.detect(P4)).toBe(true)
    expect(apacheErrorParser.detect('[proxy_fcgi:error] [pid 12] AH01075: x')).toBe(true)
    expect(apacheErrorParser.detect('[Fri Oct 09 03:26:46 2026] [error] [client 10.0.0.15] File does not exist')).toBe(true)
    expect(apacheErrorParser.detect('[09-Oct-2026 03:26:40] WARNING: [pool www]')).toBe(false)
  })

  it('parses the P4 timeout line', () => {
    const r = apacheErrorParser.parse(P4)
    expect(r?.level).toBe('ERROR')
    expect(r?.time).toBe(Date.parse('2026-10-09T03:26:40.123Z'))
    expect(r?.message).toContain('AH01075: Error dispatching request')
    expect(r?.fields).toMatchObject({ module: 'proxy_fcgi', pid: 12 })
  })

  it('parses the header without the date prefix (as printed to stderr)', () => {
    const r = apacheErrorParser.parse('[proxy_fcgi:error] [pid 12:tid 140213] (70007)The timeout specified has expired: AH01075: x')
    expect(r?.level).toBe('ERROR')
    expect(r?.time).toBeUndefined()
  })

  it.each([
    ['trace3', 'TRACE'],
    ['trace8', 'TRACE'],
    ['debug', 'DEBUG'],
    ['info', 'INFO'],
    ['notice', 'INFO'],
    ['warn', 'WARN'],
    ['error', 'ERROR'],
    ['crit', 'FATAL'],
    ['alert', 'FATAL'],
    ['emerg', 'FATAL'],
  ])('maps %s to %s', (level, expected) => {
    expect(apacheErrorParser.parse(`[Fri Oct 09 03:26:40.000001 2026] [core:${level}] [pid 1] AH00000: m`)?.level).toBe(expected)
  })

  it('parses the Apache 2.2 format', () => {
    const r = apacheErrorParser.parse('[Fri Oct 09 03:26:46 2026] [error] [client 10.0.0.15] File does not exist: /var/www/html/missing')
    expect(r).toMatchObject({ level: 'ERROR', time: Date.parse('2026-10-09T03:26:46Z') })
    expect(r?.message).toContain('File does not exist')
  })

  it('returns null for an unknown level', () => {
    expect(apacheErrorParser.parse('[Fri Oct 09 03:26:46 2026] [core:bogus] m')).toBeNull()
  })
})
