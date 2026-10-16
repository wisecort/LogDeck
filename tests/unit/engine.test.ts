import { describe, expect, it } from 'vitest'
import { compileSearch, type CompiledSearch } from '../../src/logs/search'
import { LEVELS } from '../../src/logs/types'
import { LogEngine } from '../../src/ui/engine'
import { fixtureLines } from '../helpers/entries'

const ALL = new Set(LEVELS)
const search = (text: string, exclude: string[] = []): CompiledSearch => compileSearch({ text, exclude }) as CompiledSearch

function loaded(capacity?: number) {
  const engine = new LogEngine({ now: () => 0, ...(capacity && { capacity }) })
  const lines = fixtureLines('pod-php-apache.log')
  // Feed in uneven batches, as the stream does.
  for (let i = 0; i < lines.length; i += 37) engine.ingest(lines.slice(i, i + 37))
  return engine
}

describe('LogEngine', () => {
  it('assembles entries, counts levels and groups errors', () => {
    const e = loaded()
    expect(e.size).toBe(465)
    expect(e.counts.ERROR).toBeGreaterThan(0)
    expect(e.groups().find((g) => g.id === 'apache-phpfpm-timeout')?.count).toBe(6)
  })

  it('keeps stack traces split across batches on their entry', () => {
    const e = new LogEngine({ now: () => 0 })
    e.ingest(['2026-10-09T03:26:40Z 2026-10-09 03:26:40.123 ERROR 1 --- [main] app : failed'])
    e.ingest(['2026-10-09T03:26:40Z \tat a.b.C.d(C.java:1)'])
    expect(e.entries()[0]!.continuation).toEqual(['\tat a.b.C.d(C.java:1)'])
  })

  it('filters by level (F4)', () => {
    const rows = loaded().view({ levels: new Set(['ERROR'] as const), collapse: false })
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.entry.level === 'ERROR')).toBe(true)
  })

  it('searches and excludes (F5)', () => {
    const e = loaded()
    const fpm = e.view({ levels: ALL, search: search('fpm'), collapse: false })
    expect(fpm.every((r) => /fpm/i.test(r.entry.raw + r.entry.continuation.join()))).toBe(true)
    const noHealth = e.view({ levels: ALL, search: search('', ['checagem de disponibilidade']), collapse: false })
    expect(noHealth.some((r) => r.entry.raw.includes('checagem'))).toBe(false)
  })

  it('uses regex matches computed in the worker when given', () => {
    const e = loaded()
    const seqs = new Set(e.entries().slice(0, 3).map((x) => x.seq))
    expect(e.view({ levels: ALL, regexMatches: seqs, collapse: false }).map((r) => r.entry.seq)).toEqual([...seqs])
  })

  it('filters by an error group (F6.4)', () => {
    const e = loaded()
    const group = e.groups().find((g) => g.id === 'apache-phpfpm-timeout')!
    const rows = e.view({ levels: ALL, groupSeqs: new Set(group.seqs), collapse: false })
    expect(rows).toHaveLength(6)
  })

  it('filters by a time range (histogram selection)', () => {
    const e = loaded()
    const from = Date.parse('2026-10-09T03:26:30Z')
    const to = Date.parse('2026-10-09T03:27:30Z')
    const rows = e.view({ levels: ALL, timeRange: [from, to], collapse: false })
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThan(e.size)
    for (const r of rows) {
      const t = r.entry.k8sTime ?? r.entry.logTime!
      expect(t).toBeGreaterThanOrEqual(from)
      expect(t).toBeLessThanOrEqual(to)
    }
  })

  it('collapses repeated lines when asked (P3)', () => {
    const e = loaded()
    const collapsed = e.view({ levels: ALL, collapse: true })
    const flat = e.view({ levels: ALL, collapse: false })
    expect(collapsed.length).toBeLessThan(flat.length - 100)
    expect(collapsed.some((r) => r.count === 121)).toBe(true)
  })

  it('drops the oldest entries past capacity and reports it', () => {
    const e = loaded(100)
    expect(e.size).toBe(100)
    expect(e.dropped).toBe(365)
  })

  it('bumps its version on every change and clears', () => {
    const e = new LogEngine()
    const v0 = e.version
    e.ingest(['x'])
    expect(e.version).toBeGreaterThan(v0)
    e.clear()
    expect(e.size).toBe(0)
    expect(e.groups()).toEqual([])
  })
})

describe('LogEngine without extra copies (large files, 1.6.3)', () => {
  it('bySeq finds an entry through the buffer index', () => {
    const e = loaded()
    const third = e.entries()[2]!
    expect(e.bySeq(third.seq)).toBe(third)
    expect(e.bySeq(-1)).toBeUndefined()
  })

  it('viewEntries matches view() without the row wrappers', () => {
    const e = loaded()
    const filter = { levels: new Set(['ERROR' as const]), search: search('FPM') }
    expect(e.viewEntries(filter)).toEqual(e.view({ ...filter, collapse: false }).map((r) => r.entry))
  })
})

describe('LogEngine with several pods (one stream per replica)', () => {
  const line = (sec: number, text: string) => `2026-10-09T03:26:${String(sec).padStart(2, '0')}Z ${text}`
  const merged = (clock: { now: number }) => new LogEngine({ now: () => clock.now })

  it('holds lines briefly and releases them in time order, each tagged with its pod', () => {
    const clock = { now: 0 }
    const e = merged(clock)
    e.ingest([line(1, 'a first'), line(4, 'a second')], 'web-a')
    e.ingest([line(2, 'b first'), line(3, 'b second')], 'web-b')
    expect(e.size).toBe(0)
    expect(e.flush(100, 500)).toBe(false)
    expect(e.flush(600, 500)).toBe(true)
    expect(e.entries().map((x) => `${x.pod}:${x.raw}`)).toEqual(['web-a:a first', 'web-b:b first', 'web-b:b second', 'web-a:a second'])
  })

  it('a pod still sending its backlog holds the later lines of the others, so they interleave', () => {
    const clock = { now: 0 }
    const e = merged(clock)
    e.ingest([line(1, 'a 1'), line(2, 'a 2'), line(3, 'a 3'), line(4, 'a 4')], 'web-a')
    e.ingest([line(1, 'b 1')], 'web-b')
    // web-b is still sending (slow kubectl): only what it already covers comes out
    clock.now = 400
    e.ingest([line(2, 'b 2')], 'web-b')
    e.flush(600, 500)
    expect(e.entries().map((x) => x.raw)).toEqual(['a 1', 'b 1', 'a 2'])
    clock.now = 900
    e.ingest([line(3, 'b 3'), line(4, 'b 4')], 'web-b')
    e.flush(1500, 500)
    expect(e.entries().map((x) => x.raw)).toEqual(['a 1', 'b 1', 'a 2', 'b 2', 'a 3', 'b 3', 'a 4', 'b 4'])
  })

  it('a pod that went quiet does not hold the others back', () => {
    const clock = { now: 0 }
    const e = merged(clock)
    e.ingest([line(1, 'b 1')], 'web-b')
    clock.now = 5000
    e.ingest([line(9, 'a 9')], 'web-a')
    e.flush(5600, 500)
    expect(e.entries().map((x) => x.raw)).toEqual(['b 1', 'a 9'])
  })

  it('keeps each pod stack trace on its own entry, even across batches', () => {
    const clock = { now: 0 }
    const e = merged(clock)
    e.ingest([line(1, '2026-10-09 03:26:01.000 ERROR 1 --- [main] app : failed')], 'web-a')
    e.ingest([line(1, '2026-10-09 03:26:01.000 INFO 1 --- [main] app : fine')], 'web-b')
    e.ingest([line(1, '\tat a.b.C.d(C.java:1)')], 'web-a')
    e.flush(1000, 0)
    e.ingest([line(1, '\tat a.b.C.e(C.java:2)')], 'web-a')
    const failed = e.entries().find((x) => x.pod === 'web-a')!
    expect(failed.continuation).toEqual(['\tat a.b.C.d(C.java:1)', '\tat a.b.C.e(C.java:2)'])
    expect(e.entries().find((x) => x.pod === 'web-b')!.continuation).toEqual([])
  })

  it('gives every entry its own sequence number and counts lines per pod', () => {
    const e = merged({ now: 0 })
    e.ingest([line(1, 'x'), line(2, 'y')], 'web-a')
    e.ingest([line(1, 'x')], 'web-b')
    e.flush(0, 0)
    expect(new Set(e.entries().map((x) => x.seq)).size).toBe(3)
    expect(e.podCounts).toEqual(new Map([['web-a', 2], ['web-b', 1]]))
  })

  it('hides the pods turned off', () => {
    const e = merged({ now: 0 })
    e.ingest([line(1, 'x')], 'web-a')
    e.ingest([line(2, 'y')], 'web-b')
    e.flush(0, 0)
    const rows = e.view({ levels: ALL, hiddenPods: new Set(['web-a']), collapse: false })
    expect(rows.map((r) => r.entry.pod)).toEqual(['web-b'])
  })

  it('does not collapse the same line from two pods into one row', () => {
    const e = merged({ now: 0 })
    e.ingest([line(1, 'GET /health 200')], 'web-a')
    e.ingest([line(1, 'GET /health 200')], 'web-b')
    e.flush(0, 0)
    expect(e.view({ levels: ALL, collapse: true })).toHaveLength(2)
  })

  it('clear forgets pending lines and counts', () => {
    const e = merged({ now: 0 })
    e.ingest([line(1, 'x')], 'web-a')
    e.clear()
    expect(e.flush(10_000, 0)).toBe(false)
    expect(e.podCounts.size).toBe(0)
  })
})
