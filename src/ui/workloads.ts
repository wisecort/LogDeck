// Replicas of one workload (StatefulSet, Deployment...) read together in one tab: one kubectl stream per pod.
import type { PodInfo } from '../shared/ipc'

/** Each pod is one more kubectl process: a tab follows at most this many. */
export const MAX_GROUP_PODS = 10

export interface Workload {
  kind: string
  name: string
}

export const sameWorkload = (a: Workload | undefined, b: Workload | undefined) => !!a && !!b && a.kind === b.kind && a.name === b.name

export type PodListItem = { pod: PodInfo } | { group: Workload; pods: PodInfo[] }

/** Sidebar rows: pods with the same owner (two or more) go under one group, placed where the first of them was. */
export function groupPods(pods: readonly PodInfo[]): PodListItem[] {
  const byOwner = new Map<string, PodInfo[]>()
  const key = (w: Workload) => `${w.kind}/${w.name}`
  for (const p of pods) if (p.owner) byOwner.set(key(p.owner), [...(byOwner.get(key(p.owner)) ?? []), p])
  const out: PodListItem[] = []
  const placed = new Set<string>()
  for (const p of pods) {
    const same = p.owner ? byOwner.get(key(p.owner))! : []
    if (!p.owner || same.length < 2) {
      out.push({ pod: p })
      continue
    }
    if (placed.has(key(p.owner))) continue
    placed.add(key(p.owner))
    out.push({ group: p.owner, pods: same })
  }
  return out
}

const finished = (p: PodInfo) => p.phase === 'Succeeded' || p.phase === 'Failed'

/**
 * Pods of the workload whose log is followed: app pods that did not finish, the newest MAX_GROUP_PODS,
 * in name order (keycloak-0, keycloak-1...) so each keeps its color. `total` counts them all.
 */
export function groupMembers(pods: readonly PodInfo[], w: Workload, max = MAX_GROUP_PODS): { pods: PodInfo[]; total: number } {
  const all = pods.filter((p) => p.kind === 'app' && !finished(p) && sameWorkload(p.owner, w))
  const newest = [...all].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, max)
  return { pods: newest.sort((a, b) => a.name.localeCompare(b.name)), total: all.length }
}

/** The container read in every pod: `preferred` when all have it, else the first pod's first one when all have it. */
export function sharedContainer(pods: readonly PodInfo[], preferred?: string): string | undefined {
  const inAll = (c: string) => pods.every((p) => p.containers.includes(c))
  if (preferred && pods.length > 0 && inAll(preferred)) return preferred
  const first = pods[0]?.containers[0]
  return first && inAll(first) ? first : undefined
}
