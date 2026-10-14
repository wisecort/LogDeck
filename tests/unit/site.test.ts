import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
// @ts-expect-error plain .mjs script without types
import { downloads, renderPage, LANGS } from '../../scripts/build-site.mjs'
// @ts-expect-error plain .mjs module without types
import { strings } from '../../site/i18n.mjs'

const template = readFileSync('site/index.html', 'utf8')

describe('site downloads', () => {
  it('links every installer of the version to its GitHub release', () => {
    const d = downloads('1.6.1', 'wisecort/LogDeck')
    const base = 'https://github.com/wisecort/LogDeck/releases/download/v1.6.1/'
    expect(d).toEqual({
      macArm: `${base}LogDeck-1.6.1-arm64.dmg`,
      macIntel: `${base}LogDeck-1.6.1-x64.dmg`,
      win: `${base}LogDeck-1.6.1-x64.exe`,
      deb: `${base}LogDeck-1.6.1-amd64.deb`,
      rpm: `${base}LogDeck-1.6.1-x86_64.rpm`,
      appImage: `${base}LogDeck-1.6.1-x86_64.AppImage`,
    })
  })

  it('accepts a tag and refuses anything that is not a version', () => {
    expect(downloads('v2.0.0', 'wisecort/LogDeck').win).toContain('/v2.0.0/LogDeck-2.0.0-x64.exe')
    expect(() => downloads('latest', 'wisecort/LogDeck')).toThrow()
  })
})

describe('site pages', () => {
  it('has the same strings in every language', () => {
    const keys = Object.keys(strings.en).sort()
    for (const lang of LANGS) expect(Object.keys(strings[lang]).sort()).toEqual(keys)
  })

  it.each(['en', 'pt-BR'])('renders %s with no placeholder left', (lang) => {
    const html = renderPage(template, lang, '1.6.1', 'wisecort/LogDeck')
    expect(html).not.toMatch(/\{\{/)
    expect(html).toContain(`<html lang="${lang}"`)
    expect(html).toContain('LogDeck-1.6.1-arm64.dmg')
    expect(html).toContain('hreflang="pt-BR"')
  })

  it('fails on a placeholder with no string', () => {
    expect(() => renderPage('<p>{{t.nope}}</p>', 'en', '1.6.1', 'wisecort/LogDeck')).toThrow(/nope/)
  })
})
