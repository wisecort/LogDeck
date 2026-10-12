// Native macOS menu in the interface language chosen in Preferências (default pt-BR until the UI says otherwise).
import { app, Menu } from 'electron'
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
  view: string
  window: string
}

export const MENU_LABELS: Record<MenuLang, MenuLabels> = {
  'pt-BR': { about: 'Sobre o {app}', hide: 'Ocultar {app}', hideOthers: 'Ocultar outros', showAll: 'Mostrar tudo', quit: 'Encerrar {app}', edit: 'Editar', view: 'Visualizar', window: 'Janela' },
  'pt-PT': { about: 'Acerca do {app}', hide: 'Ocultar {app}', hideOthers: 'Ocultar outros', showAll: 'Mostrar tudo', quit: 'Sair do {app}', edit: 'Editar', view: 'Visualização', window: 'Janela' },
  en: { about: 'About {app}', hide: 'Hide {app}', hideOthers: 'Hide Others', showAll: 'Show All', quit: 'Quit {app}', edit: 'Edit', view: 'View', window: 'Window' },
  es: { about: 'Acerca de {app}', hide: 'Ocultar {app}', hideOthers: 'Ocultar otros', showAll: 'Mostrar todo', quit: 'Salir de {app}', edit: 'Edición', view: 'Visualización', window: 'Ventana' },
}

export const isMenuLang = (v: unknown): v is MenuLang => typeof v === 'string' && (MENU_LANGS as readonly string[]).includes(v)

export function buildMenu(appName: string, lang: MenuLang = 'pt-BR'): void {
  const l = MENU_LABELS[lang]
  const f = (s: string) => s.replace('{app}', appName)
  app.setAboutPanelOptions({ applicationName: appName, applicationVersion: app.getVersion(), credits: `${APP_AUTHOR}\n${APP_REPOSITORY}`, copyright: `© 2026 ${APP_AUTHOR}` })
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
      { role: 'editMenu', label: l.edit },
      { role: 'viewMenu', label: l.view },
      { role: 'windowMenu', label: l.window },
    ]),
  )
}
