// New-version check: pure helpers shared by main (parsing) and the renderer (when to check).
import { APP_REPOSITORY } from './app-info'

/** At most one check a day. */
export const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000

/** null = never asked; the check only runs after the user says yes. */
export type UpdateConsent = 'on' | 'off' | null

export interface UpdateInfo {
  current: string
  latest: string
  /** Always the LogDeck release page built here, never a link from the answer. */
  url: string
  newer: boolean
}

const VERSION = /^(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/
const TAG = /^v(\d{1,4}\.\d{1,4}\.\d{1,4})$/

export function isNewerVersion(latest: string, current: string): boolean {
  const a = VERSION.exec(latest)
  const b = VERSION.exec(current)
  if (!a || !b) return false
  for (let i = 1; i <= 3; i++) {
    const d = Number(a[i]) - Number(b[i])
    if (d !== 0) return d > 0
  }
  return false
}

export function releasePageUrl(version: string): string {
  return `${APP_REPOSITORY}/releases/tag/v${version}`
}

/** Reads GitHub's "latest release" answer as data: only a vX.Y.Z tag of a published release counts. */
export function parseLatestRelease(json: unknown): { version: string; url: string } | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null
  const r = json as Record<string, unknown>
  if (r.draft === true || r.prerelease === true) return null
  const version = typeof r.tag_name === 'string' ? TAG.exec(r.tag_name)?.[1] : undefined
  if (!version) return null
  return { version, url: releasePageUrl(version) }
}

export function shouldCheckForUpdate(p: { consent: UpdateConsent; lastCheck: number; now: number }): boolean {
  if (p.consent !== 'on') return false
  if (p.lastCheck > p.now) return true
  return p.now - p.lastCheck >= UPDATE_INTERVAL_MS
}
