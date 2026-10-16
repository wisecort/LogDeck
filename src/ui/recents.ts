// The last pods whose log was opened (sidebar "Recentes"). Per-user convenience in localStorage.
import type { PodInfo } from '../shared/ipc'

export interface RecentPod {
  context: string
  namespace: string
  pod: string
  container: string
  /** Set when the entry is a group of replicas: the owner kind, and `pod` is the owner name. */
  group?: string
}

const KEY = 'logdeck.recents'
const MAX = 5

export const recentKey = (r: Pick<RecentPod, 'context' | 'namespace' | 'pod' | 'group'>) => `${r.context}::${r.namespace}::${r.group ? `${r.group}/` : ''}${r.pod}`

export function pushRecent(list: readonly RecentPod[], item: RecentPod): RecentPod[] {
  const key = recentKey(item)
  return [item, ...list.filter((r) => recentKey(r) !== key)].slice(0, MAX)
}

const isRecent = (v: unknown): v is RecentPod =>
  !!v &&
  typeof v === 'object' &&
  ['context', 'namespace', 'pod', 'container'].every((k) => typeof (v as Record<string, unknown>)[k] === 'string') &&
  ['string', 'undefined'].includes(typeof (v as Record<string, unknown>)['group'])

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

/** `<owner>-<ReplicaSet hash or DeploymentConfig number>-<5-char suffix>`: names Kubernetes generates. */
const GENERATED = /^(.+)-([a-z0-9]{1,10})-([a-z0-9]{5})$/

/**
 * A recent pod that is gone was usually recreated by its Deployment (or OKD DeploymentConfig) under a new name.
 * Returns the pod that took its place: same owner, an app pod with the same container, running; the same
 * ReplicaSet first, then the newest. Undefined when the name was not generated or nothing matches.
 */
export function findReplacement(gone: string, container: string, pods: readonly PodInfo[]): PodInfo | undefined {
  const old = GENERATED.exec(gone)
  if (!old) return undefined
  const [, owner, hash] = old
  const candidates = pods.filter((p) => {
    const m = GENERATED.exec(p.name)
    return m?.[1] === owner && p.kind === 'app' && p.phase === 'Running' && p.containers.includes(container)
  })
  const rank = (p: PodInfo) => [GENERATED.exec(p.name)?.[2] === hash ? 1 : 0, p.createdAt ?? 0] as const
  return candidates.sort((a, b) => {
    const [sa, ta] = rank(a)
    const [sb, tb] = rank(b)
    return sb - sa || tb - ta
  })[0]
}
