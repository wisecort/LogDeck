import { describe, expect, it } from 'vitest'
import { heuristicParser } from '../../src/logs/parsers/heuristic'

describe('heuristic parser (last resort)', () => {
  it('always detects', () => {
    expect(heuristicParser.detect('anything')).toBe(true)
  })

  it.each([
    ['2026-10-09 03:26:40.123 ERROR 1 --- [main] c.e.portal.Application : Application run failed', 'ERROR'],
    ['2026-10-09 03:26:41.000  INFO 1 --- [main] Started', 'INFO'],
    ['2026-10-09 03:26:42.000  WARN 1 --- [main] slow', 'WARN'],
    ['WARNING something odd', 'WARN'],
    ['2026-10-09 03:26:43.000 DEBUG 1 --- [main] warming cache', 'DEBUG'],
    ['TRACE entering method', 'TRACE'],
    ['FATAL could not start', 'FATAL'],
  ])('uses an explicit level token: %s', (line, level) => {
    expect(heuristicParser.parse(line)?.level).toBe(level)
  })

  it('prefers the explicit level token over keywords', () => {
    expect(heuristicParser.parse('INFO retrying after error')?.level).toBe('INFO')
  })

  it.each([
    ['panic: runtime error: invalid memory address or nil pointer dereference', 'FATAL'],
    ['Exception in thread "main" java.lang.OutOfMemoryError: Java heap space', 'ERROR'],
    ["chown: changing ownership of '/var/log/php-fpm/error.log': Operation not permitted", 'ERROR'],
    ["mkdir: cannot create directory '/run/httpd': Permission denied", 'ERROR'],
    ['request failed with status 500', 'ERROR'],
    ['Connection timed out after 30s', 'WARN'],
    ['upstream timeout', 'WARN'],
    ['this API is deprecated', 'WARN'],
  ])('falls back to keywords: %s', (line, level) => {
    expect(heuristicParser.parse(line)?.level).toBe(level)
  })

  it('does not match keywords inside other words', () => {
    expect(heuristicParser.parse('processed 0 errors')?.level).toBeUndefined()
    expect(heuristicParser.parse('Starting php-fpm...')?.level).toBeUndefined()
  })

  it('extracts a leading ISO-like timestamp (UTC when no offset)', () => {
    expect(heuristicParser.parse('2026-10-09 03:26:40.123 ERROR boom')?.time).toBe(Date.parse('2026-10-09T03:26:40.123Z'))
    expect(heuristicParser.parse('2026-10-09T03:26:40+02:00 INFO x')?.time).toBe(Date.parse('2026-10-09T01:26:40Z'))
  })

  it('keeps the whole line as message', () => {
    expect(heuristicParser.parse('Starting php-fpm...')?.message).toBe('Starting php-fpm...')
  })
})
