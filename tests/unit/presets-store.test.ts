import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PresetStore } from '../../src/main/presets-store'

const dir = () => mkdtempSync(join(tmpdir(), 'logdeck-presets-'))

describe('PresetStore', () => {
  it('returns the default (health checks active) for an unknown namespace', () => {
    expect(new PresetStore(join(dir(), 'presets.json')).get('ctx::ns')).toEqual({ presets: [], active: ['health-checks'] })
  })

  it('persists per context+namespace and survives a restart', () => {
    const file = join(dir(), 'presets.json')
    const store = new PresetStore(file)
    store.set('ctx::a', { presets: [{ id: 'p1', name: 'Assets', terms: ['/assets/'] }], active: ['p1'] })
    store.set('ctx::b', { presets: [], active: [] })
    const reopened = new PresetStore(file)
    expect(reopened.get('ctx::a')).toEqual({ presets: [{ id: 'p1', name: 'Assets', terms: ['/assets/'] }], active: ['p1'] })
    expect(reopened.get('ctx::b')).toEqual({ presets: [], active: [] })
  })

  it('sanitizes what it stores', () => {
    const file = join(dir(), 'presets.json')
    const saved = new PresetStore(file).set('ctx::a', { presets: [{ id: 'p1', name: 'x', terms: [1, 'ok'] }], active: ['nope'] } as never)
    expect(saved).toEqual({ presets: [{ id: 'p1', name: 'x', terms: ['ok'] }], active: [] })
    expect(JSON.parse(readFileSync(file, 'utf8'))['ctx::a']).toEqual(saved)
  })

  it('starts empty when the file is corrupt', () => {
    const file = join(dir(), 'presets.json')
    writeFileSync(file, '{not json')
    expect(new PresetStore(file).get('ctx::a')).toEqual({ presets: [], active: ['health-checks'] })
  })
})
