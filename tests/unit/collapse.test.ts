import { describe, expect, it } from 'vitest'
import { assemble } from '../../src/logs/classify'
import { collapseRows } from '../../src/logs/collapse'
import { entry, fixtureLines } from '../helpers/entries'

describe('collapseRows (P3)', () => {
  it('collapses the 121 consecutive availability checks into one ×121 row', () => {
    const rows = collapseRows(assemble(fixtureLines('pod-php-apache.log'), { now: () => 0 }))
    const health = rows.find((r) => r.entry.raw.includes('checagem de disponibilidade'))!
    expect(health.count).toBe(121)
    expect(health.firstTime).toBe(Date.parse('2026-10-09T03:24:01Z'))
    expect(health.lastTime).toBe(Date.parse('2026-10-09T03:26:01Z'))
  })

  it('keeps different or non-consecutive lines apart', () => {
    const a = entry({ raw: 'same', level: 'INFO' })
    const b = entry({ raw: 'other', level: 'INFO' })
    const c = entry({ raw: 'same', level: 'INFO' })
    expect(collapseRows([a, b, c]).map((r) => r.count)).toEqual([1, 1, 1])
  })

  it('ignores timestamps inside the line when comparing', () => {
    const rows = collapseRows([
      entry({ raw: '[09-Oct-2026 03:26:40] WARNING: [pool www] server reached pm.max_children' }),
      entry({ raw: '[09-Oct-2026 03:26:41] WARNING: [pool www] server reached pm.max_children' }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.count).toBe(2)
  })

  it('does not merge entries with different levels or stack traces', () => {
    expect(collapseRows([entry({ raw: 'x', level: 'INFO' }), entry({ raw: 'x', level: 'ERROR' })])).toHaveLength(2)
    expect(collapseRows([entry({ raw: 'x', continuation: ['#0 a'] }), entry({ raw: 'x', continuation: ['#0 b'] })])).toHaveLength(2)
  })

  it('keeps the latest entry of a group for display and returns [] for no input', () => {
    const a = entry({ raw: 'x' })
    const b = entry({ raw: 'x' })
    expect(collapseRows([a, b])[0]!.entry).toBe(b)
    expect(collapseRows([])).toEqual([])
  })
})
