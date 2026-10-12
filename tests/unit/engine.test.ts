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
