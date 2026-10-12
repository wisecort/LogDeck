// Selectable themes. The choice is a per-user convenience kept in localStorage (may be unavailable).

export const THEMES = [
  { id: 'escuro', name: 'Escuro' },
  { id: 'meia-noite', name: 'Meia-noite' },
  { id: 'claro', name: 'Claro' },
  { id: 'sistema', name: 'Sistema (macOS)' },
  { id: 'alto-contraste', name: 'Alto contraste' },
  { id: 'dracula', name: 'Dracula' },
  { id: 'nord', name: 'Nord' },
  { id: 'tokyo-night', name: 'Tokyo Night' },
  { id: 'catppuccin', name: 'Catppuccin Mocha' },
  { id: 'matrix', name: 'Matrix' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

const KEY = 'logdeck.theme'
export const DEFAULT_THEME: ThemeId = 'escuro'

export function loadTheme(): ThemeId {
  try {
    const v = localStorage.getItem(KEY)
    if (THEMES.some((t) => t.id === v)) return v as ThemeId
  } catch {
    // storage unavailable: fall back to the default
  }
  return DEFAULT_THEME
}

export function applyTheme(id: ThemeId): void {
  document.documentElement.dataset['theme'] = id
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // ignore
  }
}
