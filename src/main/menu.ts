// Native macOS menu in the interface language chosen in Preferências (default pt-BR until the UI says otherwise).
import { app, Menu, systemPreferences } from 'electron'
import { APP_AUTHOR, APP_REPOSITORY } from '../shared/app-info'

export const MENU_LANGS = ['pt-BR', 'pt-PT', 'en', 'es'] as const
export type MenuLang = (typeof MENU_LANGS)[number]

interface MenuLabels {
  about: string
  hide: string
  hideOthers: string
  showAll: string
  quit: string
  edit: string
  undo: string
  redo: string
  cut: string
  copy: string
  paste: string
  selectAll: string
  window: string
  minimize: string
  close: string
}

export const MENU_LABELS: Record<MenuLang, MenuLabels> = {
  'pt-BR': {
    about: 'Sobre o {app}', hide: 'Ocultar {app}', hideOthers: 'Ocultar outros', showAll: 'Mostrar tudo', quit: 'Encerrar {app}',
    edit: 'Editar', undo: 'Desfazer', redo: 'Refazer', cut: 'Recortar', copy: 'Copiar', paste: 'Colar', selectAll: 'Selecionar tudo',
    window: 'Janela', minimize: 'Minimizar', close: 'Fechar janela',
  },
  'pt-PT': {
    about: 'Acerca do {app}', hide: 'Ocultar {app}', hideOthers: 'Ocultar outros', showAll: 'Mostrar tudo', quit: 'Sair do {app}',
    edit: 'Editar', undo: 'Anular', redo: 'Refazer', cut: 'Cortar', copy: 'Copiar', paste: 'Colar', selectAll: 'Selecionar tudo',
    window: 'Janela', minimize: 'Minimizar', close: 'Fechar janela',
  },
  en: {
    about: 'About {app}', hide: 'Hide {app}', hideOthers: 'Hide Others', showAll: 'Show All', quit: 'Quit {app}',
    edit: 'Edit', undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'Select All',
    window: 'Window', minimize: 'Minimize', close: 'Close Window',
  },
  es: {
    about: 'Acerca de {app}', hide: 'Ocultar {app}', hideOthers: 'Ocultar otros', showAll: 'Mostrar todo', quit: 'Salir de {app}',
    edit: 'Edición', undo: 'Deshacer', redo: 'Rehacer', cut: 'Cortar', copy: 'Copiar', paste: 'Pegar', selectAll: 'Seleccionar todo',
    window: 'Ventana', minimize: 'Minimizar', close: 'Cerrar ventana',
  },
}

export const isMenuLang = (v: unknown): v is MenuLang => typeof v === 'string' && (MENU_LANGS as readonly string[]).includes(v)

export function buildMenu(appName: string, lang: MenuLang = 'pt-BR'): void {
  const l = MENU_LABELS[lang]
  const f = (s: string) => s.replace('{app}', appName)
  app.setAboutPanelOptions({ applicationName: appName, applicationVersion: app.getVersion(), credits: APP_REPOSITORY, copyright: `© 2026 ${APP_AUTHOR}` })
  // Windows/Linux: no menu bar at all (copy/paste still work in inputs; the app has its own UI for everything else).
  if (process.platform !== 'darwin') return Menu.setApplicationMenu(null)
  // Only what LogDeck uses: no View menu (reload/devtools), no Dictation or Emoji items macOS injects into Edit.
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: appName,
        submenu: [
          { role: 'about', label: f(l.about) },
          { type: 'separator' },
          { role: 'hide', label: f(l.hide) },
          { role: 'hideOthers', label: l.hideOthers },
          { role: 'unhide', label: l.showAll },
          { type: 'separator' },
          { role: 'quit', label: f(l.quit) },
        ],
      },
      {
        label: l.edit,
        submenu: [
          { role: 'undo', label: l.undo },
          { role: 'redo', label: l.redo },
          { type: 'separator' },
          { role: 'cut', label: l.cut },
          { role: 'copy', label: l.copy },
          { role: 'paste', label: l.paste },
          { role: 'selectAll', label: l.selectAll },
        ],
      },
      {
        label: l.window,
        submenu: [
          { role: 'minimize', label: l.minimize },
          { role: 'close', label: l.close },
        ],
      },
    ]),
  )
}

/** Must run before the first menu is built: stops macOS adding "Start Dictation…" and "Emoji & Symbols". */
export function disableSystemMenuItems(): void {
  if (process.platform !== 'darwin') return
  systemPreferences.setUserDefault('NSDisabledDictationMenuItem', 'boolean', true)
  systemPreferences.setUserDefault('NSDisabledCharacterPaletteMenuItem', 'boolean', true)
}
