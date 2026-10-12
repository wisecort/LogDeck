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
] as const

export type ThemeId = (typeof THEMES)[number]['id']

/** Colors for the theme picker thumbnails (mirrors the CSS tokens). */
export const THEME_PREVIEW: Record<ThemeId, { bg: string; panel: string; fg: string; accent: string; levels: [string, string, string] }> = {
  escuro: { bg: '#15161a', panel: '#1b1c21', fg: '#e6e6eb', accent: '#4f8cff', levels: ['#3fb9a8', '#e3b341', '#ff7b72'] },
  'meia-noite': { bg: '#0d0e1a', panel: '#121329', fg: '#e7e7f5', accent: '#8b7bff', levels: ['#34d1a3', '#f2b84b', '#ff6b8a'] },
  claro: { bg: '#ffffff', panel: '#f5f5f7', fg: '#1d1d1f', accent: '#0a66e4', levels: ['#0f7b6c', '#9a6700', '#cf222e'] },
  sistema: { bg: 'linear-gradient(135deg, #ffffff 50%, #15161a 50%)', panel: '#8a8a92', fg: '#1d1d1f', accent: '#0a66e4', levels: ['#0f7b6c', '#e3b341', '#cf222e'] },
  'alto-contraste': { bg: '#000000', panel: '#000000', fg: '#ffffff', accent: '#ffd400', levels: ['#4dfff0', '#ffd400', '#ff4d4d'] },
  dracula: { bg: '#282a36', panel: '#21222c', fg: '#f8f8f2', accent: '#bd93f9', levels: ['#8be9fd', '#f1fa8c', '#ff5555'] },
  nord: { bg: '#2e3440', panel: '#292e39', fg: '#eceff4', accent: '#88c0d0', levels: ['#8fbcbb', '#ebcb8b', '#bf616a'] },
  'tokyo-night': { bg: '#1a1b26', panel: '#16161e', fg: '#c0caf5', accent: '#7aa2f7', levels: ['#7dcfff', '#e0af68', '#f7768e'] },
  catppuccin: { bg: '#1e1e2e', panel: '#181825', fg: '#cdd6f4', accent: '#cba6f7', levels: ['#94e2d5', '#f9e2af', '#f38ba8'] },
}

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
