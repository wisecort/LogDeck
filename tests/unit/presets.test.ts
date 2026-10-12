import { describe, expect, it } from 'vitest'
import { activeTerms, HEALTH_CHECK_PRESET, presetKey, sanitizePresets } from '../../src/shared/presets'

describe('exclusion presets (P3)', () => {
  it('ships a built-in "Ocultar health checks" preset', () => {
    expect(HEALTH_CHECK_PRESET).toMatchObject({ id: 'health-checks', name: 'Ocultar health checks', builtin: true })
    expect(HEALTH_CHECK_PRESET.terms).toEqual(expect.arrayContaining(['checagem de disponibilidade', 'kube-probe/', 'GET /healthz']))
  })

  it('keys presets by context and namespace', () => {
    expect(presetKey('ctx/a:6443/u', 'portal-hml')).toBe('ctx/a:6443/u::portal-hml')
  })

  it('unions the terms of active presets, including the built-in one', () => {
    const terms = activeTerms({
      presets: [{ id: 'p1', name: 'Assets', terms: ['/assets/', 'favicon.ico'] }],
      active: ['health-checks', 'p1'],
    })
    expect(terms).toEqual(expect.arrayContaining(['kube-probe/', '/assets/', 'favicon.ico']))
    expect(activeTerms({ presets: [], active: [] })).toEqual([])
  })

  it('sanitizes untrusted data from disk or IPC', () => {
    expect(sanitizePresets(null)).toEqual({ presets: [], active: [] })
    expect(sanitizePresets({ presets: 'x', active: 3 })).toEqual({ presets: [], active: [] })
    const clean = sanitizePresets({
      presets: [
        { id: 'p1', name: 'Ok', terms: ['a', 3, '', 'b'] },
        { id: 'health-checks', name: 'fake builtin', terms: ['x'] },
        { id: 'p2', name: 'x'.repeat(200), terms: ['y'.repeat(500)] },
        { name: 'no id', terms: ['z'] },
      ],
      active: ['p1', 'unknown', 'health-checks', 5],
    })
    expect(clean.presets.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(clean.presets[0]!.terms).toEqual(['a', 'b'])
    expect(clean.presets[1]!.name.length).toBeLessThanOrEqual(60)
    expect(clean.presets[1]!.terms[0]!.length).toBeLessThanOrEqual(200)
    expect(clean.active).toEqual(['p1', 'health-checks'])
  })

  it('limits the number of presets and terms', () => {
    const many = sanitizePresets({
      presets: Array.from({ length: 80 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, terms: Array.from({ length: 80 }, (_, j) => `t${j}`) })),
      active: [],
    })
    expect(many.presets).toHaveLength(50)
    expect(many.presets[0]!.terms).toHaveLength(50)
  })
})
