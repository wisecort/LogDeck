import { describe, expect, it } from 'vitest'
import { jsonParser } from '../../src/logs/parsers/json'

const t = (iso: string) => Date.parse(iso)

describe('json parser', () => {
  it('detects lines starting with {', () => {
    expect(jsonParser.detect('{"level":"info","msg":"x"}')).toBe(true)
    expect(jsonParser.detect('  {"level":"info"}')).toBe(true)
    expect(jsonParser.detect('[2026-10-09 03:26:40] production.ERROR: x')).toBe(false)
  })

  it('parses Monolog/Laravel JSON (level_name, datetime, message)', () => {
    const r = jsonParser.parse(
      '{"message":"Payment gateway timeout","context":{"order":42},"level":400,"level_name":"ERROR","channel":"production","datetime":"2026-10-09T03:26:40.123456+00:00","extra":{}}',
    )
    expect(r).toMatchObject({ level: 'ERROR', message: 'Payment gateway timeout', time: t('2026-10-09T03:26:40.123Z') })
  })

  it.each([
    [100, 'DEBUG'],
    [200, 'INFO'],
    [250, 'INFO'],
    [300, 'WARN'],
    [400, 'ERROR'],
    [500, 'FATAL'],
    [550, 'FATAL'],
    [600, 'FATAL'],
  ])('maps numeric Monolog level %i to %s', (level, expected) => {
    expect(jsonParser.parse(JSON.stringify({ level, message: 'x' }))?.level).toBe(expected)
  })

  it.each([
    [10, 'TRACE'],
    [20, 'DEBUG'],
    [30, 'INFO'],
    [40, 'WARN'],
    [50, 'ERROR'],
    [60, 'FATAL'],
  ])('maps numeric pino level %i to %s', (level, expected) => {
    expect(jsonParser.parse(JSON.stringify({ level, time: 1791516400000, msg: 'x' }))?.level).toBe(expected)
  })

  it('parses pino epoch-millisecond time and msg', () => {
    const r = jsonParser.parse('{"level":50,"time":1791516401000,"pid":7,"hostname":"api-6f7c9","msg":"connect ETIMEDOUT 10.0.0.9:5432"}')
    expect(r).toMatchObject({ level: 'ERROR', time: 1791516401000, message: 'connect ETIMEDOUT 10.0.0.9:5432' })
  })

  it('parses zap string levels and epoch-second ts', () => {
    const r = jsonParser.parse('{"level":"warn","ts":1791516402.123,"caller":"server/http.go:88","msg":"slow request"}')
    expect(r).toMatchObject({ level: 'WARN', time: 1791516402123, message: 'slow request' })
  })

  it.each(['dpanic', 'panic', 'fatal', 'critical', 'emergency'])('maps %s to FATAL', (level) => {
    expect(jsonParser.parse(JSON.stringify({ level, msg: 'x' }))?.level).toBe('FATAL')
  })

  it('accepts severity/timestamp (cloud logging) and lvl/t keys', () => {
    expect(jsonParser.parse('{"severity":"INFO","timestamp":"2026-10-09T03:26:44Z","message":"m"}')).toMatchObject({
      level: 'INFO',
      time: t('2026-10-09T03:26:44Z'),
    })
    expect(jsonParser.parse('{"lvl":"debug","t":"2026-10-09T03:26:47Z","msg":"m"}')).toMatchObject({
      level: 'DEBUG',
      time: t('2026-10-09T03:26:47Z'),
    })
  })

  it('maps information/dbug aliases and ignores unknown names', () => {
    expect(jsonParser.parse('{"level":"information","msg":"m"}')?.level).toBe('INFO')
    expect(jsonParser.parse('{"level":"dbug","msg":"m"}')?.level).toBe('DEBUG')
    expect(jsonParser.parse('{"level":"verbose","msg":"m"}')?.level).toBeUndefined()
  })

  it('maps warning/err aliases', () => {
    expect(jsonParser.parse('{"level":"warning","msg":"m"}')?.level).toBe('WARN')
    expect(jsonParser.parse('{"level":"err","msg":"m"}')?.level).toBe('ERROR')
  })

  it('leaves level undefined when there is no level field', () => {
    const r = jsonParser.parse('{"msg":"no level here"}')
    expect(r?.level).toBeUndefined()
    expect(r?.message).toBe('no level here')
  })

  it('falls back to the raw line as message when there is no message field', () => {
    const line = '{"level":"info","event":"boot"}'
    expect(jsonParser.parse(line)?.message).toBe(line)
  })

  it('returns null for truncated or invalid JSON', () => {
    expect(jsonParser.parse('{"level":"error","msg":"cut')).toBeNull()
    expect(jsonParser.parse('{not json}')).toBeNull()
  })

  it('returns null for JSON that is not an object', () => {
    expect(jsonParser.parse('[1,2,3]')).toBeNull()
  })
})
