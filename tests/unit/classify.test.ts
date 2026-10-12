import { beforeAll, describe, expect, it } from 'vitest'
import type { LogEntry } from '../../src/logs/types'
import { assemble, DIVERGENCE_MS, displayTime, isContinuation, LogAssembler, splitK8sTimestamp } from '../../src/logs/classify'
import { fixtureLines, fixtureLogFiles } from '../helpers/entries'

const NOW = 1_800_000_000_000
const now = () => NOW

describe('splitK8sTimestamp', () => {
  it('splits the RFC3339Nano prefix added by --timestamps', () => {
    expect(splitK8sTimestamp('2026-10-09T03:26:40.648123456Z hello world')).toEqual({
      k8sTime: Date.parse('2026-10-09T03:26:40.648Z'),
      rest: 'hello world',
    })
  })

  it('handles trimmed fractions and no fraction', () => {
    expect(splitK8sTimestamp('2026-10-09T03:20:00.1Z x').k8sTime).toBe(Date.parse('2026-10-09T03:20:00.100Z'))
    expect(splitK8sTimestamp('2026-10-09T03:20:00Z x').k8sTime).toBe(Date.parse('2026-10-09T03:20:00Z'))
  })

  it('keeps an empty message after the prefix', () => {
    expect(splitK8sTimestamp('2026-10-09T03:20:00Z ')).toEqual({ k8sTime: Date.parse('2026-10-09T03:20:00Z'), rest: '' })
  })

  it('leaves lines without a valid prefix untouched', () => {
    expect(splitK8sTimestamp('hello')).toEqual({ rest: 'hello' })
    expect(splitK8sTimestamp('2026-13-45T99:99:99Z x')).toEqual({ rest: '2026-13-45T99:99:99Z x' })
  })
})

describe('isContinuation', () => {
  it.each([
    '\tat org.springframework.boot.SpringApplication.run(SpringApplication.java:325)',
    '    at Object.<anonymous> (/app/index.js:1:1)',
    '#0 /var/www/html/app/Http/Controllers/UserController.php(31): x()',
    '#12 {main}',
    'Caused by: java.net.SocketTimeoutException: Connect timed out',
    '\t... 12 more',
    '... 12 more',
    'Stack trace:',
    'Next Illuminate\\Database\\QueryException: x',
    '[stacktrace]',
    '"}',
    'java.lang.IllegalStateException: Failed to execute CommandLineRunner',
    'java.lang.NullPointerException',
  ])('treats %j as continuation', (line) => {
    expect(isContinuation(line)).toBe(true)
  })

  it.each([
    '10.0.0.2 - - [09/Oct/2026:03:26:40 +0000] "GET / HTTP/1.1" 200 1 "-" "x"',
    '[2026-10-09 03:26:40] production.ERROR: x',
    'Starting php-fpm...',
    '',
    '{"level":"info"}',
  ])('treats %j as a new entry', (line) => {
    expect(isContinuation(line)).toBe(false)
  })
})

describe('LogAssembler', () => {
  it('emits entries with monotonic seq starting at startSeq', () => {
    const a = new LogAssembler({ now, startSeq: 10 })
    const e1 = a.push('2026-10-09T03:26:40Z [09-Oct-2026 03:26:40] NOTICE: one')
    const e2 = a.push('2026-10-09T03:26:41Z [09-Oct-2026 03:26:41] NOTICE: two')
    expect(e1).toMatchObject({ type: 'entry', entry: { seq: 10, level: 'INFO', parser: 'php-fpm', ingestTime: NOW } })
    expect(e2).toMatchObject({ type: 'entry', entry: { seq: 11 } })
  })

  it('emits continuation events pointing to the previous entry', () => {
    const a = new LogAssembler({ now })
    a.push('2026-10-09T03:26:40Z 2026-10-09 03:26:40.123 ERROR 1 --- [main] app : failed')
    expect(a.push('2026-10-09T03:26:40Z \tat a.b.C.d(C.java:1)')).toEqual({ type: 'continuation', seq: 1, text: '\tat a.b.C.d(C.java:1)' })
  })

  it('turns a leading continuation-looking line into its own entry', () => {
    const a = new LogAssembler({ now })
    expect(a.push('\tat a.b.C.d(C.java:1)').type).toBe('entry')
  })

  it('falls back to UNKNOWN when nothing matches', () => {
    const r = new LogAssembler({ now }).push('Starting php-fpm...')
    expect(r).toMatchObject({ type: 'entry', entry: { level: 'UNKNOWN', parser: 'heuristic' } })
  })

  it('keeps the raw line without the k8s prefix', () => {
    const r = new LogAssembler({ now }).push('2026-10-09T03:26:40Z hello')
    expect(r.type === 'entry' && r.entry.raw).toBe('hello')
  })
})

describe('assemble (multiline)', () => {
  it('glues the Laravel stack trace to its entry', () => {
    const entries = assemble(fixtureLines('laravel.log'), { now })
    expect(entries).toHaveLength(8)
    expect(entries[0]).toMatchObject({ level: 'ERROR', parser: 'laravel' })
    expect(entries[0]!.continuation).toHaveLength(5)
    expect(entries[0]!.continuation.at(-1)).toBe('"}')
  })

  it('glues the Java stack trace and inherits ERROR', () => {
    const entries = assemble(fixtureLines('java.log'), { now })
    expect(entries).toHaveLength(4)
    expect(entries[0]!.level).toBe('ERROR')
    expect(entries[0]!.continuation).toHaveLength(6)
    expect(entries.map((e) => e.level)).toEqual(['ERROR', 'INFO', 'WARN', 'DEBUG'])
  })
})

describe('levels on the real-world pod log (P1, P4)', () => {
  let entries: LogEntry[] = []
  beforeAll(() => {
    entries = assemble(fixtureLines('pod-php-apache.log'), { now })
  })

  it('classifies the AH01075 timeouts as ERROR via apache-error', () => {
    const ah = entries.filter((e) => e.raw.includes('AH01075'))
    expect(ah).toHaveLength(6)
    for (const e of ah) expect(e).toMatchObject({ level: 'ERROR', parser: 'apache-error' })
  })

  it('classifies health checks as INFO via access', () => {
    const hc = entries.filter((e) => e.raw.includes('checagem de disponibilidade'))
    expect(hc.length).toBeGreaterThanOrEqual(120)
    for (const e of hc) expect(e).toMatchObject({ level: 'INFO', parser: 'access' })
  })

  it('classifies chown/mkdir permission errors as ERROR', () => {
    const perm = entries.filter((e) => /^(chown|mkdir):/.test(e.raw))
    expect(perm).toHaveLength(3)
    for (const e of perm) expect(e.level).toBe('ERROR')
  })

  it('classifies pm.max_children as WARN', () => {
    expect(entries.filter((e) => e.raw.includes('pm.max_children')).map((e) => e.level)).toEqual(['WARN', 'WARN', 'WARN'])
  })
})

describe('timestamps (P2)', () => {
  let entries: LogEntry[] = []
  beforeAll(() => {
    entries = assemble(fixtureLines('pod-php-apache.log'), { now })
  })

  it('never uses the ingestion time as the display time', () => {
    for (const e of entries) {
      expect(e.ingestTime).toBe(NOW)
      expect(displayTime(e).time).not.toBe(NOW)
    }
  })

  it('gives every line of a --timestamps stream a k8s time, so they are not all equal', () => {
    expect(entries.every((e) => typeof e.k8sTime === 'number')).toBe(true)
    expect(new Set(entries.map((e) => displayTime(e).time)).size).toBeGreaterThan(entries.length * 0.9)
  })

  it('prefers the log time and flags no divergence when close to k8s time', () => {
    const hc = entries.find((e) => e.raw.includes('checagem de disponibilidade'))!
    expect(displayTime(hc)).toMatchObject({ source: 'log', divergent: false, time: hc.logTime })
  })

  it('flags divergence when the app logs in another time zone (Laravel UTC-3)', () => {
    const lar = entries.find((e) => e.parser === 'laravel')!
    expect(lar.k8sTime! - lar.logTime!).toBeGreaterThan(3 * 3600_000 - DIVERGENCE_MS)
    expect(displayTime(lar)).toMatchObject({ source: 'log', divergent: true })
  })

  it('falls back to k8s time when the line has no time of its own', () => {
    const chown = entries.find((e) => e.raw.startsWith('chown:'))!
    expect(chown.logTime).toBeUndefined()
    expect(displayTime(chown)).toEqual({ time: chown.k8sTime, source: 'k8s', divergent: false })
  })

  it('reports no time at all rather than the ingestion time', () => {
    expect(displayTime({ ingestTime: NOW })).toEqual({ time: undefined, source: 'none', divergent: false })
  })
})

describe('UNKNOWN rate on the fixture corpus (P1 goal)', () => {
  it('is below 5%', () => {
    let total = 0
    let unknown = 0
    for (const file of fixtureLogFiles()) {
      const entries = assemble(fixtureLines(file), { now })
      total += entries.length
      unknown += entries.filter((e) => e.level === 'UNKNOWN').length
    }
    expect(total).toBeGreaterThan(400)
    expect(unknown / total).toBeLessThan(0.05)
  })
})
