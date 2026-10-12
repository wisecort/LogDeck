// The last pods whose log was opened (sidebar "Recentes"). Per-user convenience in localStorage.

export interface RecentPod {
  context: string
  namespace: string
  pod: string
  container: string
}

const KEY = 'logdeck.recents'
const MAX = 5

export const recentKey = (r: Pick<RecentPod, 'context' | 'namespace' | 'pod'>) => `${r.context}::${r.namespace}::${r.pod}`

export function pushRecent(list: readonly RecentPod[], item: RecentPod): RecentPod[] {
  const key = recentKey(item)
  return [item, ...list.filter((r) => recentKey(r) !== key)].slice(0, MAX)
}

const isRecent = (v: unknown): v is RecentPod =>
  !!v && typeof v === 'object' && ['context', 'namespace', 'pod', 'container'].every((k) => typeof (v as Record<string, unknown>)[k] === 'string')

export function loadRecents(): RecentPod[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter(isRecent).slice(0, MAX) : []
  } catch {
    return []
  }
}

export function saveRecents(list: readonly RecentPod[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}
