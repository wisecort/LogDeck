import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))

describe('app identity', () => {
  it('is branded as LogDeck', () => {
    expect(pkg.name).toBe('logdeck')
    expect(pkg.productName).toBe('LogDeck')
    expect(pkg.build.productName).toBe('LogDeck')
  })

  it('uses the approved bundle id and license', () => {
    expect(pkg.build.appId).toBe('io.github.wisecort.logdeck')
    expect(pkg.license).toBe('MIT')
  })

  it('credits the author (Preferências → Sobre, About panel, package.json)', async () => {
    const { APP_AUTHOR } = await import('../../src/shared/app-info')
    expect(APP_AUTHOR).toBe('Matheus Corteletti — Wise')
    expect(pkg.author).toBe('Matheus Corteletti (Wise)')
  })

  it('only builds for macOS (G10)', () => {
    expect(pkg.build.mac).toBeDefined()
    expect(pkg.build.win).toBeUndefined()
    expect(pkg.build.linux).toBeUndefined()
  })
})
