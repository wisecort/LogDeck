// Credits shown in Preferências → Sobre and in the macOS About panel.
export const APP_AUTHOR = 'Matheus Corteletti — Wise'
export const APP_REPOSITORY = 'https://github.com/wisecort/LogDeck'

/** The only external pages the app opens (main checks the id, never a URL from the renderer). */
export const APP_LINKS = {
  github: APP_REPOSITORY,
  linkedin: 'https://www.linkedin.com/in/cortelettimatheus/',
  releases: `${APP_REPOSITORY}/releases/latest`,
} as const

export type AppLink = keyof typeof APP_LINKS
