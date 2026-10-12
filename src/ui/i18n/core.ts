// Interface language (pt-BR, pt-PT, English, Spanish): pure helpers, no React.
import { en } from './en'
import { es } from './es'
import { ptBR, type MessageKey } from './pt-BR'
import { ptPT } from './pt-PT'

export const LANGUAGES = [
  { id: 'pt-BR', name: 'Português (Brasil)' },
  { id: 'pt-PT', name: 'Português (Portugal)' },
  { id: 'en', name: 'English' },
  { id: 'es', name: 'Español' },
] as const

export type Lang = (typeof LANGUAGES)[number]['id']
export type { MessageKey }

export const DICTIONARIES: Record<Lang, Record<MessageKey, string>> = { 'pt-BR': ptBR, 'pt-PT': ptPT, en, es }

const KEY = 'logdeck.language'

/** Maps a BCP 47 tag (navigator.language) to a supported language; Portuguese defaults to pt-BR, unknown to English. */
export function matchLanguage(tag: string | undefined): Lang {
  const t = (tag ?? '').toLowerCase()
  if (t === 'pt-pt' || t.startsWith('pt-pt')) return 'pt-PT'
  if (t.startsWith('pt')) return 'pt-BR'
  if (t.startsWith('es')) return 'es'
  if (t.startsWith('en')) return 'en'
  return 'en'
}

export function loadLanguage(): Lang {
  try {
    const v = localStorage.getItem(KEY)
    if (LANGUAGES.some((l) => l.id === v)) return v as Lang
  } catch {
    // storage unavailable
  }
  return matchLanguage(typeof navigator === 'undefined' ? undefined : navigator.language)
}

export function saveLanguage(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang)
  } catch {
    // ignore
  }
}

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string

export function translator(lang: Lang): Translate {
  const dict = DICTIONARIES[lang]
  return (key, vars) => {
    const text = dict[key] ?? ptBR[key]
    return vars ? text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m)) : text
  }
}

