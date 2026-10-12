import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { compileSearch, entryText, searchWithTimeout, type CompiledSearch } from '../logs/search'
import { LEVELS, type Level } from '../logs/types'
import type { ContextInfo, NamespaceList, PodInfo } from '../shared/ipc'
import { activeTerms, presetKey, type NamespacePresets } from '../shared/presets'
import { ErrorsPanel } from './components/ErrorsPanel'
import { LevelFilter } from './components/LevelFilter'
import { LogList } from './components/LogList'
import { ProdBanner } from './components/ProdBanner'
import { SearchBar, type SearchState } from './components/SearchBar'
import { ShellPanel, type ShellTarget } from './components/ShellPanel'
import { Sidebar } from './components/Sidebar'
import { Toolbar, type LogOptions } from './components/Toolbar'
import { parseTerms } from './format'
import { browserRegexRunner } from './regex-runner'
import { useLogSession } from './useLogSession'

const POD_REFRESH_MS = 5000
const REGEX_DEBOUNCE_MS = 250

export function App() {
  const [contexts, setContexts] = useState<ContextInfo[]>([])
  const [context, setContext] = useState<string>()
  const [namespaces, setNamespaces] = useState<NamespaceList>()
  const [namespace, setNamespace] = useState<string>()
  const [pods, setPods] = useState<PodInfo[]>([])
  const [podsLoading, setPodsLoading] = useState(false)
  const [pod, setPod] = useState<PodInfo>()
  const [container, setContainer] = useState<string>()
  const [options, setOptions] = useState<LogOptions>({ tail: 1000, since: '', previous: false })
  const [notice, setNotice] = useState<string>()
  const [now, setNow] = useState(() => Date.now())

  const [levels, setLevels] = useState<ReadonlySet<Level>>(new Set(LEVELS))
  const [search, setSearch] = useState<SearchState>({ text: '', regex: false, caseSensitive: false, exclude: '' })
  const [presets, setPresets] = useState<NamespacePresets>()
  const [collapse, setCollapse] = useState(true)
  const [groupKey, setGroupKey] = useState<string>()
  const [selectedGroups, setSelectedGroups] = useState<ReadonlySet<string>>(new Set())
  // Version shown while paused; undefined = live.
  const [frozen, setFrozen] = useState<number>()
  const paused = frozen !== undefined
  const [regexMatches, setRegexMatches] = useState<ReadonlySet<number>>()
  const [regexError, setRegexError] = useState<string>()
  const [cursor, setCursor] = useState<number>()
  const [shell, setShell] = useState<ShellTarget>()
  const searchRef = useRef<HTMLInputElement>(null)

  const session = useLogSession()
  const { engine, version, status } = session
  const selectedContext = contexts.find((c) => c.name === context)

  // F1: contexts and kubectl presence.
  useEffect(() => {
    void (async () => {
      const v = await window.logdeck.kubectlVersion()
      if (!v.installed) {
        setNotice(v.message)
        return
      }
      try {
        const list = await window.logdeck.listContexts()
        setContexts(list)
        if (list.length === 0) setNotice('Nenhum contexto no kubeconfig (arquivo padrão do kubectl ou variável KUBECONFIG).')
      } catch (err) {
        setNotice((err as Error).message)
      }
    })()
  }, [])

  const selectContext = async (name: string) => {
    await session.stop()
    setShell(undefined)
    setContext(name)
    setNamespace(undefined)
    setPods([])
    setPod(undefined)
    setContainer(undefined)
    setNotice(undefined)
    try {
      const ns = await window.logdeck.listNamespaces(name)
      setNamespaces(ns)
      if (!ns.canList && ns.defaultNamespace) void selectNamespace(name, ns.defaultNamespace)
    } catch (err) {
      setNotice((err as Error).message)
    }
  }

  const loadPods = useCallback(async (ctx: string, ns: string) => {
    setPodsLoading(true)
    try {
      setPods(await window.logdeck.listPods(ctx, ns))
      setNow(Date.now())
    } catch (err) {
      setNotice((err as Error).message)
    } finally {
      setPodsLoading(false)
    }
  }, [])

  const selectNamespace = async (ctx: string, ns: string) => {
    await session.stop()
    setNamespace(ns)
    setPod(undefined)
    setContainer(undefined)
    setGroupKey(undefined)
    setPresets(await window.logdeck.getPresets(presetKey(ctx, ns)))
    await loadPods(ctx, ns)
  }

  // F2.2: refresh pod status every 5 s while a namespace is open.
  useEffect(() => {
    if (!context || !namespace) return
    const t = setInterval(() => {
      if (!document.hidden) void loadPods(context, namespace)
    }, POD_REFRESH_MS)
    return () => clearInterval(t)
  }, [context, namespace, loadPods])

  const openLogs = useCallback(
    (p: PodInfo, c: string, o: LogOptions) => {
      if (!context || !namespace) return
      setFrozen(undefined)
      setGroupKey(undefined)
      setSelectedGroups(new Set())
      void session.start({
        context,
        namespace,
        pod: p.name,
        container: c,
        tail: o.tail,
        ...(o.since && { since: o.since }),
        ...(o.previous && { previous: true }),
      })
    },
    [context, namespace, session],
  )

  // F2.3: single-container pods open directly; others wait for a choice.
  const selectPod = (p: PodInfo) => {
    setPod(p)
    setShell(undefined)
    const opts = { ...options, previous: options.previous && p.canPrevious }
    setOptions(opts)
    if (p.containers.length === 1 && p.initContainers.length === 0) {
      setContainer(p.containers[0])
      openLogs(p, p.containers[0]!, opts)
    } else {
      setContainer(undefined)
      void session.stop()
    }
  }

  const selectContainer = (c: string) => {
    setContainer(c)
    if (pod) openLogs(pod, c, options)
  }

  const changeOptions = (o: LogOptions) => {
    setOptions(o)
    if (pod && container) openLogs(pod, container, o)
  }

  const savePresets = async (p: NamespacePresets) => {
    if (!context || !namespace) return
    setPresets(await window.logdeck.setPresets(presetKey(context, namespace), p))
  }

  // F5: plain-text search compiled on the UI thread; regex goes to a worker with a time budget.
  const excludeTerms = useMemo(
    () => [...parseTerms(search.exclude), ...(presets ? activeTerms(presets) : [])],
    [search.exclude, presets],
  )
  const compiled = useMemo((): CompiledSearch | undefined => {
    const c = compileSearch({ text: search.regex ? '' : search.text, caseSensitive: search.caseSensitive, exclude: excludeTerms })
    return c.ok ? c : undefined
  }, [search.text, search.regex, search.caseSensitive, excludeTerms])
  const highlightSearch = useMemo((): CompiledSearch | undefined => {
    if (!search.text) return undefined
    const c = compileSearch({ text: search.text, mode: search.regex ? 'regex' : 'text', caseSensitive: search.caseSensitive })
    return c.ok ? c : undefined
  }, [search.text, search.regex, search.caseSensitive])

  const regexActive = search.regex && search.text !== ''
  useEffect(() => {
    if (!regexActive) return
    const t = setTimeout(() => {
      const entries = engine.entries()
      void searchWithTimeout(
        entries.map(entryText),
        { text: search.text, mode: 'regex', caseSensitive: search.caseSensitive },
        { runner: browserRegexRunner, timeoutMs: 250 },
      ).then((r) => {
        if (r.status === 'ok') {
          setRegexError(undefined)
          setRegexMatches(new Set(r.matches.map((i) => entries[i]!.seq)))
        } else {
          setRegexMatches(new Set())
          setRegexError(r.status === 'timeout' ? 'Regex muito custosa: busca interrompida (250 ms)' : r.message)
        }
      })
    }, REGEX_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [regexActive, search.text, search.caseSensitive, version, engine])

  const groups = useMemo(() => engine.groups(), [engine, version]) // eslint-disable-line react-hooks/exhaustive-deps
  const groupSeqs = useMemo(() => {
    const g = groups.find((x) => x.key === groupKey)
    return g ? new Set(g.seqs) : undefined
  }, [groups, groupKey])

  // Paused: keep showing the last rows while the buffer keeps filling.
  const viewVersion = frozen ?? version
  const effectiveRegex = regexActive ? (regexMatches ?? new Set<number>()) : undefined
  const rows = useMemo(
    () =>
      engine.view({
        levels,
        ...(compiled && { search: compiled }),
        ...(effectiveRegex && { regexMatches: effectiveRegex }),
        ...(groupSeqs && { groupSeqs }),
        collapse,
      }),
    [engine, viewVersion, levels, compiled, effectiveRegex, groupSeqs, collapse], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const counts = useMemo(() => engine.counts, [engine, version]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleLevel = (l: Level, solo: boolean) => {
    if (solo) return setLevels(new Set([l]))
    const next = new Set(levels)
    if (next.has(l)) next.delete(l)
    else next.add(l)
    setLevels(next)
  }

  // ⌘F focuses search; ⌘G / ⇧⌘G walk through the matching rows.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey) return
      if (e.key === 'f') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      } else if (e.key === 'g' && rows.length > 0) {
        e.preventDefault()
        setCursor((c) => {
          if (c === undefined) return e.shiftKey ? rows.length - 1 : 0
          return (c + (e.shiftKey ? rows.length - 1 : 1)) % rows.length
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rows.length])

  return (
    <div className="app">
      {selectedContext?.production && <ProdBanner context={selectedContext.name} />}
      {notice && (
        <div className="notice" role="status">
          {notice}
          <button className="link" onClick={() => setNotice(undefined)}>
            ×
          </button>
        </div>
      )}
      <div className="layout">
        <Sidebar
          contexts={contexts}
          {...(context && { context })}
          onContext={(n) => void selectContext(n)}
          {...(namespaces && { namespaces })}
          {...(namespace && { namespace })}
          onNamespace={(n) => context && void selectNamespace(context, n)}
          pods={pods}
          podsLoading={podsLoading}
          {...(pod && { pod })}
          onPod={selectPod}
          {...(container && { container })}
          onContainer={selectContainer}
          now={now}
        />
        <main className="main">
          <Toolbar
            {...(status && { status })}
            paused={paused}
            onPause={() => setFrozen((f) => (f === undefined ? version : undefined))}
            options={options}
            onOptions={changeOptions}
            canPrevious={pod?.canPrevious ?? false}
            onReconnect={() => pod && container && openLogs(pod, container, options)}
            dropped={engine.dropped}
            canShell={Boolean(pod && container && !pod.initContainers.includes(container))}
            onShell={() => context && namespace && pod && container && setShell({ context, namespace, pod: pod.name, container })}
          />
          <LevelFilter counts={counts} levels={levels} onToggle={toggleLevel} />
          <SearchBar
            value={search}
            onChange={(v) => {
              setSearch(v)
              setCursor(undefined)
            }}
            inputRef={searchRef}
            {...(regexActive && regexError && { error: regexError })}
            matchCount={rows.length}
            total={engine.size}
            {...(presets && { presets })}
            onPresets={(p) => void savePresets(p)}
            collapse={collapse}
            onCollapse={setCollapse}
          />
          <LogList rows={rows} {...(highlightSearch && { search: highlightSearch })} {...(cursor !== undefined && { cursor })} />
          {shell && <ShellPanel target={shell} onClose={() => setShell(undefined)} />}
        </main>
        <ErrorsPanel
          groups={groups}
          {...(groupKey && { activeKey: groupKey })}
          onSelect={setGroupKey}
          selected={selectedGroups}
          onToggleSelected={(k) => {
            const next = new Set(selectedGroups)
            if (next.has(k)) next.delete(k)
            else next.add(k)
            setSelectedGroups(next)
          }}
        />
      </div>
    </div>
  )
}
