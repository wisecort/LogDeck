import { useCallback, useState } from 'react'
import type { BuildInfo, ContextInfo, NamespaceList, PodInfo } from '../shared/ipc'
import { loadActiveContext, loadAliases, loadHiddenContexts, saveAliases, pickActiveContext, saveActiveContext, saveHiddenContexts, visibleContexts } from './context-view'

export interface FavoriteNs {
  context: string
  namespace: string
}

const FAV_KEY = 'logdeck.favorites'

function loadFavorites(): FavoriteNs[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter((f): f is FavoriteNs => typeof f?.context === 'string' && typeof f?.namespace === 'string') : []
  } catch {
    return []
  }
}

export const nsKey = (context: string, namespace: string) => `${context}::${namespace}`

/** Lazily loaded context → namespace → pod tree (block F). */
export function useNavigation(onError: (message: string) => void) {
  const [contexts, setContexts] = useState<ContextInfo[]>([])
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [namespaces, setNamespaces] = useState<Record<string, NamespaceList>>({})
  const [pods, setPods] = useState<Record<string, PodInfo[]>>({})
  const [builds, setBuilds] = useState<Record<string, BuildInfo[]>>({})
  const [loading, setLoading] = useState<ReadonlySet<string>>(new Set())
  const [favorites, setFavorites] = useState<FavoriteNs[]>(loadFavorites)
  const [savedContext, setSavedContext] = useState<string | undefined>(loadActiveContext)
  const [hiddenContexts, setHidden] = useState<string[]>(loadHiddenContexts)
  const [aliases, setAliases] = useState<Record<string, string>>(loadAliases)

  /** Display name in LogDeck only (empty = back to the derived label); the kubeconfig is never edited (G4). */
  const setAlias = (name: string, alias: string) => {
    const next = { ...aliases }
    const value = alias.trim().slice(0, 60)
    if (value) next[name] = value
    else delete next[name]
    setAliases(next)
    saveAliases(next)
  }
  const visible = visibleContexts(contexts, hiddenContexts)
  const activeContext = pickActiveContext(visible, savedContext)

  /** Hides a context in LogDeck only; the kubeconfig is never edited (G4). */
  const toggleHidden = (name: string) => {
    const next = hiddenContexts.includes(name) ? hiddenContexts.filter((n) => n !== name) : [...hiddenContexts, name]
    setHidden(next)
    saveHiddenContexts(next)
    ensureNamespaces(pickActiveContext(visibleContexts(contexts, next), savedContext))
  }

  const mark = (key: string, on: boolean) =>
    setLoading((prev) => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })

  const expand = (key: string, open?: boolean) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (open ?? !next.has(key)) next.add(key)
      else next.delete(key)
      return next
    })

  const loadNamespaces = useCallback(
    async (context: string) => {
      mark(`ctx:${context}`, true)
      try {
        const list = await window.logdeck.listNamespaces(context)
        setNamespaces((prev) => ({ ...prev, [context]: list }))
        return list
      } catch (err) {
        onError((err as Error).message)
        return undefined
      } finally {
        mark(`ctx:${context}`, false)
      }
    },
    [onError],
  )

  const loadPods = useCallback(
    async (context: string, namespace: string) => {
      const key = nsKey(context, namespace)
      mark(`ns:${key}`, true)
      // OKD builds next to the pods; [] on plain Kubernetes, never an error
      void window.logdeck.listBuilds(context, namespace).then(
        (list) => setBuilds((prev) => ({ ...prev, [key]: list })),
        () => setBuilds((prev) => ({ ...prev, [key]: [] })),
      )
      try {
        const list = await window.logdeck.listPods(context, namespace)
        setPods((prev) => ({ ...prev, [key]: list }))
        return list
      } catch (err) {
        onError((err as Error).message)
        return undefined
      } finally {
        mark(`ns:${key}`, false)
      }
    },
    [onError],
  )

  const ensureNamespaces = (context: string | undefined) => {
    if (context && !namespaces[context]) void loadNamespaces(context)
  }

  /** Receives the kubeconfig contexts and loads the namespaces of the active one. */
  const showContexts = (list: ContextInfo[]) => {
    setContexts(list)
    ensureNamespaces(pickActiveContext(visibleContexts(list, hiddenContexts), savedContext))
  }

  /** Switches the sidebar to another context; never touches the kubeconfig (G4). */
  const selectContext = (context: string) => {
    setSavedContext(context)
    saveActiveContext(context)
    ensureNamespaces(context)
  }

  const openNamespace = async (context: string, namespace: string, open?: boolean) => {
    const key = nsKey(context, namespace)
    const willOpen = open ?? !expanded.has(`ns:${key}`)
    if (context !== activeContext) {
      setSavedContext(context)
      saveActiveContext(context)
    }
    expand(`ctx:${context}`, true)
    expand(`ns:${key}`, willOpen)
    if (willOpen && !namespaces[context]) await loadNamespaces(context)
    if (willOpen) await loadPods(context, namespace)
  }

  /** For contexts that cannot list namespaces (OKD RBAC). */
  const addNamespace = (context: string, namespace: string) =>
    setNamespaces((prev) => {
      const cur = prev[context] ?? { namespaces: [], canList: false }
      return cur.namespaces.includes(namespace) ? prev : { ...prev, [context]: { ...cur, namespaces: [...cur.namespaces, namespace] } }
    })

  const toggleFavorite = (context: string, namespace: string) =>
    setFavorites((prev) => {
      const exists = prev.some((f) => f.context === context && f.namespace === namespace)
      const next = exists ? prev.filter((f) => !(f.context === context && f.namespace === namespace)) : [...prev, { context, namespace }]
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })

  return {
    contexts,
    showContexts,
    activeContext,
    selectContext,
    visible,
    hiddenContexts,
    toggleHidden,
    aliases,
    setAlias,
    loadNamespaces,
    expanded,
    expand,
    namespaces,
    pods,
    builds,
    loading,
    favorites,
    openNamespace,
    loadPods,
    addNamespace,
    toggleFavorite,
  }
}

export type Navigation = ReturnType<typeof useNavigation>
