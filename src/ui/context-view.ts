// The single active context shown in the sidebar, and how context names are displayed.
import type { ContextInfo } from '../shared/ipc'

const KEY = 'logdeck.activeContext'
const HIDDEN_KEY = 'logdeck.hiddenContexts'

export function visibleContexts(all: readonly ContextInfo[], hidden: readonly string[]): ContextInfo[] {
  const set = new Set(hidden)
  return all.filter((c) => !set.has(c.name))
}

/** Shown to the user to run in their own terminal; LogDeck never edits the kubeconfig (G1/G4). */
export function deleteContextCommand(name: string): string {
  return `kubectl config delete-context '${name.replaceAll("'", "'\\''")}'`
}

/** Last picked context if it still exists, else the kubeconfig current context, else the first one. */
export function pickActiveContext(all: readonly ContextInfo[], saved: string | undefined): string | undefined {
  if (saved && all.some((c) => c.name === saved)) return saved
  return (all.find((c) => c.current) ?? all[0])?.name
}

/** OKD/`oc login` names look like `project/api-host:6443/user`. */
export function contextLabel(name: string): { title: string; subtitle: string } {
  const [title = name, cluster] = name.split('/')
  if (cluster === undefined) return { title: name, subtitle: '' }
  return { title, subtitle: cluster.replace(/:\d+$/, '') }
}

export function loadActiveContext(): string | undefined {
  try {
    return localStorage.getItem(KEY) ?? undefined
  } catch {
    return undefined
  }
}

export function saveActiveContext(name: string): void {
  try {
    localStorage.setItem(KEY, name)
  } catch {
    // storage unavailable: the choice lasts only for this session
  }
}

export function loadHiddenContexts(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter((n): n is string => typeof n === 'string') : []
  } catch {
    return []
  }
}

export function saveHiddenContexts(names: readonly string[]): void {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(names))
  } catch {
    // ignore
  }
}
