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

  it('builds for macOS (Apple Silicon and Intel), Linux and Windows (1.1.0)', () => {
    const archs = (targets: Array<{ arch: string[] }>) => [...new Set(targets.flatMap((t) => t.arch))].sort()
    expect(archs(pkg.build.mac.target)).toEqual(['arm64', 'x64'])
    expect(pkg.build.linux.target.map((t: { target: string }) => t.target).sort()).toEqual(['AppImage', 'deb', 'rpm'])
    expect(pkg.build.win.target.map((t: { target: string }) => t.target)).toEqual(['nsis'])
  })
})
