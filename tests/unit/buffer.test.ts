import { describe, expect, it } from 'vitest'
import { DEFAULT_CAPACITY, LogBuffer, MAX_CAPACITY } from '../../src/logs/buffer'
import { LEVELS, type Level } from '../../src/logs/types'
import { entry } from '../helpers/entries'

const sum = (counts: Readonly<Record<Level, number>>) => LEVELS.reduce((acc, l) => acc + counts[l], 0)

describe('LogBuffer', () => {
  it('defaults to 50,000 entries', () => {
    expect(new LogBuffer().capacity).toBe(DEFAULT_CAPACITY)
    expect(DEFAULT_CAPACITY).toBe(50_000)
  })

  it.each([0, -1, 1.5, MAX_CAPACITY + 1, Number.NaN])('rejects capacity %s', (capacity) => {
    expect(() => new LogBuffer({ capacity })).toThrow(RangeError)
  })

  it('keeps insertion order', () => {
    const b = new LogBuffer({ capacity: 3 })
    const [a, c] = [entry(), entry()]
    b.push(a)
    b.push(c)
    expect(b.size).toBe(2)
    expect(b.toArray()).toEqual([a, c])
    expect(b.at(0)).toBe(a)
    expect(b.at(1)).toBe(c)
    expect(b.at(2)).toBeUndefined()
  })

  it('drops the oldest entries when full and counts them', () => {
    const b = new LogBuffer({ capacity: 3 })
    const es = Array.from({ length: 5 }, () => entry())
    b.pushMany(es)
    expect(b.size).toBe(3)
    expect(b.dropped).toBe(2)
    expect(b.toArray()).toEqual(es.slice(2))
    expect(b.at(0)).toBe(es[2])
  })

  it('keeps per-level counters consistent with the content, including drops', () => {
    const b = new LogBuffer({ capacity: 100 })
    let x = 7
    for (let i = 0; i < 1000; i++) {
      x = (x * 31 + 11) % 997
      b.push(entry({ level: LEVELS[x % LEVELS.length] }))
      if (i % 97 === 0) {
        const actual = Object.fromEntries(LEVELS.map((l) => [l, b.toArray().filter((e) => e.level === l).length]))
        expect(b.counts).toEqual(actual)
      }
    }
    expect(sum(b.counts)).toBe(b.size)
    expect(b.dropped).toBe(900)
  })

  it('decrements the level of the dropped entry', () => {
    const b = new LogBuffer({ capacity: 1 })
    b.push(entry({ level: 'ERROR' }))
    b.push(entry({ level: 'INFO' }))
    expect(b.counts.ERROR).toBe(0)
    expect(b.counts.INFO).toBe(1)
  })

  it('finds entries by seq and appends continuation lines', () => {
    const b = new LogBuffer({ capacity: 2 })
    const e1 = entry()
    const e2 = entry()
    b.pushMany([e1, e2])
    expect(b.bySeq(e2.seq)).toBe(e2)
    expect(b.appendContinuation(e2.seq, '\tat x')).toBe(true)
    expect(b.bySeq(e2.seq)!.continuation).toEqual(['\tat x'])
    b.push(entry())
    expect(b.bySeq(e1.seq)).toBeUndefined()
    expect(b.appendContinuation(e1.seq, '\tat y')).toBe(false)
  })

  it('clears content, counters and drops', () => {
    const b = new LogBuffer({ capacity: 1 })
    b.pushMany([entry({ level: 'WARN' }), entry({ level: 'WARN' })])
    b.clear()
    expect(b.size).toBe(0)
    expect(b.dropped).toBe(0)
    expect(sum(b.counts)).toBe(0)
    expect(b.toArray()).toEqual([])
  })

  it('absorbs 200k entries into a 50k buffer quickly (backpressure, RNF6)', () => {
    const b = new LogBuffer()
    const es = Array.from({ length: 200_000 }, () => entry())
    const t0 = performance.now()
    b.pushMany(es)
    expect(performance.now() - t0).toBeLessThan(500)
    expect(b.size).toBe(50_000)
    expect(b.dropped).toBe(150_000)
    expect(b.at(0)).toBe(es[150_000])
  })
})
