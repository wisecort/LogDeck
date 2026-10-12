import { describe, expect, it } from 'vitest'
import { assemble } from '../../src/logs/classify'
import { buildVolume } from '../../src/ui/volume'
import { entry, fixtureLines } from '../helpers/entries'

describe('buildVolume (histogram, block D)', () => {
  it('stacks counts per level into time buckets', () => {
    const entries = assemble(fixtureLines('pod-php-apache.log'), { now: () => 0 })
    const v = buildVolume(entries, 60)
    expect(v.buckets).toHaveLength(60)
    expect(v.buckets.reduce((n, b) => n + b.total, 0)).toBe(entries.length)
    expect(v.buckets.reduce((n, b) => n + b.counts.ERROR, 0)).toBe(entries.filter((e) => e.level === 'ERROR').length)
    expect(v.max).toBe(Math.max(...v.buckets.map((b) => b.total)))
    expect(v.start).toBeLessThan(v.end)
    expect(v.buckets[1]!.from - v.buckets[0]!.from).toBe(v.bucketMs)
  })

  it('uses the kubectl clock, so a log in another time zone does not stretch the axis', () => {
    const entries = assemble(fixtureLines('pod-php-apache.log'), { now: () => 0 })
    const v = buildVolume(entries, 60)
    expect(v.start).toBe(Math.min(...entries.map((e) => e.k8sTime!)))
    expect(v.end - v.start).toBeLessThan(10 * 60_000)
  })

  it('handles empty input and entries without time', () => {
    expect(buildVolume([], 10)).toEqual({ start: 0, end: 0, bucketMs: 0, max: 0, buckets: [] })
    expect(buildVolume([entry({ k8sTime: undefined, logTime: undefined })], 10).buckets).toEqual([])
  })

  it('puts all entries of a single instant in one bucket', () => {
    const v = buildVolume([entry({ k8sTime: 1000 }), entry({ k8sTime: 1000, level: 'ERROR' })], 10)
    expect(v.buckets.filter((b) => b.total > 0)).toHaveLength(1)
    expect(v.max).toBe(2)
  })
})
