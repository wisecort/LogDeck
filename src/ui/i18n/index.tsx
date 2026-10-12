// React side of the i18n: the provider and the hook. The choice is a per-user convenience in localStorage.
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { translator, type Lang, type Translate } from './core'

export * from './core'

interface I18n {
  lang: Lang
  t: Translate
  /** Number formatted for the current language. */
  n(value: number): string
}

const Ctx = createContext<I18n>({ lang: 'pt-BR', t: translator('pt-BR'), n: (v) => v.toLocaleString('pt-BR') })

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo<I18n>(() => ({ lang, t: translator(lang), n: (v) => v.toLocaleString(lang) }), [lang])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useI18n = () => useContext(Ctx)
