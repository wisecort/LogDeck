// React side of the i18n: the provider and the hook. The choice is a per-user convenience in localStorage.
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { isMacUserAgent, platformKeys } from '../../platform/keys'
import { translator, type Lang, type Translate } from './core'

export * from './core'

interface I18n {
  lang: Lang
  t: Translate
  /** Number formatted for the current language. */
  n(value: number): string
  /** Shortcut label for this OS: ⌘ on macOS, Ctrl elsewhere. */
  k(text: string): string
}

const IS_MAC = typeof navigator !== 'undefined' && isMacUserAgent(navigator.userAgent)

const Ctx = createContext<I18n>({ lang: 'pt-BR', t: translator('pt-BR'), n: (v) => v.toLocaleString('pt-BR'), k: (s) => s })

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo<I18n>(() => {
    const base = translator(lang)
    const k = (text: string) => platformKeys(text, IS_MAC)
    return { lang, t: (key, vars) => k(base(key, vars)), n: (v) => v.toLocaleString(lang), k }
  }, [lang])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useI18n = () => useContext(Ctx)
