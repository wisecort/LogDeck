// Tab list state (several pods/files open at once). Pure: the hook useLogTabs wires engines and streams to it.
import type { LogOptions, Selection } from './view-types'

export const MAX_TABS = 8

export interface Tab {
  id: string
  selection: Selection
  options: LogOptions
  /** Name of a local file opened in this tab. */
  file?: string
  /** Showing the previous container (--previous) side by side. */
  compare?: boolean
}

/** Slot of the side-by-side --previous stream of a tab. */
export const companionKey = (tabId: string) => `${tabId}:previous`

export interface TabsState {
  tabs: Tab[]
  active: string
}

export const DEFAULT_OPTIONS: LogOptions = { tail: 1000, since: '', previous: false }

let counter = 0
const newId = () => `tab-${Date.now().toString(36)}-${(counter++).toString(36)}`
const emptyTab = (options: LogOptions = DEFAULT_OPTIONS): Tab => ({ id: newId(), selection: {}, options })

export function initialTabs(): TabsState {
  const tab = emptyTab()
  return { tabs: [tab], active: tab.id }
}

/** New empty tab right after the active one; undefined when the limit is reached (each tab may run a kubectl). */
export function addTab(s: TabsState): TabsState | undefined {
  if (s.tabs.length >= MAX_TABS) return undefined
  const current = s.tabs.find((t) => t.id === s.active)
  const tab = emptyTab(current?.options)
  const at = s.tabs.findIndex((t) => t.id === s.active) + 1
  return { tabs: [...s.tabs.slice(0, at), tab, ...s.tabs.slice(at)], active: tab.id }
}

/**
 * The Home button: an empty tab (shown as the home screen, never in the tab bar) becomes active.
 * Reuses one if there is any, so pod tabs keep their logs; undefined at the limit with no empty tab.
 */
export function homeTab(s: TabsState): TabsState | undefined {
  const isEmpty = (t: Tab) => tabLabel(t) === undefined
  if (s.tabs.some((t) => t.id === s.active && isEmpty(t))) return s
  const empty = s.tabs.find(isEmpty)
  return empty ? { ...s, active: empty.id } : addTab(s)
}

export function closeTab(s: TabsState, id: string): TabsState {
  const index = s.tabs.findIndex((t) => t.id === id)
  if (index < 0) return s
  const tabs = s.tabs.filter((t) => t.id !== id)
  if (tabs.length === 0) return initialTabs()
  const active = s.active === id ? tabs[Math.min(index, tabs.length - 1)]!.id : s.active
  return { tabs, active }
}

export function activateTab(s: TabsState, id: string): TabsState {
  return s.tabs.some((t) => t.id === id) ? { ...s, active: id } : s
}

export function updateTab(s: TabsState, id: string, patch: Partial<Omit<Tab, 'id'>>): TabsState {
  return { ...s, tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) }
}

/** Undefined for an empty tab: it shows the home screen and stays out of the tab bar. */
export function tabLabel(tab: Tab): string | undefined {
  if (tab.file) return tab.file
  const { pod, container, build, group } = tab.selection
  if (group) return `${group.name} (${group.pods.length} pods)`
  if (!pod) return build?.name

  return container ? `${pod.name} / ${container}` : pod.name
}
