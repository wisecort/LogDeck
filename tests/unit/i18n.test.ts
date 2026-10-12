import { describe, expect, it } from 'vitest'
import { DICTIONARIES, LANGUAGES, matchLanguage, translator } from '../../src/ui/i18n/core'
import { ptBR } from '../../src/ui/i18n/pt-BR'
import { CATALOG_IDS } from '../../src/logs/signatures'

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('i18n dictionaries', () => {
  const base = Object.keys(ptBR).sort()

  for (const { id } of LANGUAGES) {
    it(`${id} has exactly the pt-BR keys, none empty, same placeholders`, () => {
      const dict = DICTIONARIES[id]
      expect(Object.keys(dict).sort()).toEqual(base)
      for (const key of base as Array<keyof typeof ptBR>) {
        expect(dict[key].trim(), `${id} ${key}`).not.toBe('')
        expect(placeholders(dict[key]), `${id} ${key}`).toEqual(placeholders(ptBR[key]))
      }
    })
  }

  it('en and es are real translations, not copies of pt-BR (Spanish shares many words)', () => {
    const keys = (Object.keys(ptBR) as Array<keyof typeof ptBR>).filter((k) => !k.startsWith('theme.'))
    for (const [id, max] of [['en', 0.1], ['es', 0.3]] as const) {
      const same = keys.filter((k) => DICTIONARIES[id][k] === ptBR[k])
      expect(same.length / keys.length, `${id}: ${same.join(', ')}`).toBeLessThan(max)
    }
  })
})

describe('translator', () => {
  it('fills placeholders and keeps unknown ones', () => {
    expect(translator('en')('st.lines', { shown: 3, total: 10 })).toBe('3 / 10 lines')
    expect(translator('pt-BR')('vol.tip', { n: 2 })).toBe('2 linhas · {time}')
  })
})

describe('matchLanguage', () => {
  it.each([
    ['pt-BR', 'pt-BR'],
    ['pt', 'pt-BR'],
    ['pt-PT', 'pt-PT'],
    ['es-AR', 'es'],
    ['en-US', 'en'],
    ['de-DE', 'en'],
    [undefined, 'en'],
  ])('%s → %s', (tag, lang) => {
    expect(matchLanguage(tag)).toBe(lang)
  })
})

describe('F6 catalog titles', () => {
  it('every catalog rule has a translated title', () => {
    for (const id of CATALOG_IDS) expect(Object.keys(ptBR)).toContain(`sig.${id}`)
  })
})
