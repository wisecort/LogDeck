import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { compileSearch, countExcluded, entryText, searchWithTimeout, type CompiledSearch } from '../logs/search'
import { LEVELS, type Level } from '../logs/types'
import type { ExplainGroupInput } from '../shared/ai'
import type { AiStatus } from '../shared/ai-settings'
import type { BuildInfo, Exposure, PodEvent, PodInfo, TerminatedRun, VersionInfo } from '../shared/ipc'
import { podAccess } from './pod-access'
import { activeTerms, presetKey, type NamespacePresets } from '../shared/presets'
import { aroundEntry, visibleLines } from './ai-context'
import { AiPreferences } from './components/AiPreferences'
import { LevelBar } from './components/LevelBar'
import { StreamControl } from './components/StreamControl'
import { LogList, type ScrollCommand } from './components/LogList'
import { aiLabel, RightPanel, type AiContextMode, type PanelTab } from './components/RightPanel'
import { ShellPanel, type ShellTarget } from './components/ShellPanel'
import { ShortcutsModal } from './components/ShortcutsModal'
import { NoticeBar } from './components/NoticeBar'
import { noticeFromError, type Notice } from './notice'
import { FileErrorModal } from './components/FileErrorModal'
import { Sidebar, type Selection } from './components/Sidebar'
import { StatusBar } from './components/StatusBar'
import { TopBar, type LogOptions, type SearchState } from './components/TopBar'
import { VolumeChart } from './components/VolumeChart'
import { parseTerms } from './format'
import { browserRegexRunner } from './regex-runner'
import { isMacUserAgent } from '../platform/keys'
import { I18nProvider, loadLanguage, saveLanguage, translator, type Lang } from './i18n'
import { LogFileError, MAX_LOG_FILE_BYTES, type LogFileProblem } from '../logs/file'
import { PreferencesModal } from './components/PreferencesModal'
import { applyTheme, loadTheme, type ThemeId } from './theme'
import { useLogTabs } from './useLogTabs'
import { TabBar } from './components/TabBar'
import { Welcome } from './components/Welcome'
import { BuildDetails } from './components/BuildDetails'
import { MAX_TABS } from './tabs'
import { nsKey, runsKey, useNavigation } from './useNavigation'
import { containerDetail, uptime } from './pod-status'
import { eventMarks, placeMarks, quietMarks, restartMarks } from '../logs/marks'
import { displayLabel } from './context-view'
import { groupTitle } from './group-title'
import { loadBufferLines, saveBufferLines } from './buffer-pref'
import { findReplacement, loadRecents, pushRecent, recentKey, saveRecents, type RecentPod } from './recents'
import { useUpdateCheck } from './useUpdateCheck'
import { UpdateModal } from './components/UpdateModal'

const POD_REFRESH_MS = 5000
// Events change slowly; each read is one more kubectl process (costly on OKD logins).
const EVENTS_REFRESH_MS = 15_000
// Extra reads (events, services, routes, ingresses) wait for the log's first lines, at most this long.
const EXTRAS_DELAY_MS = 3000
const NO_RUNS: readonly TerminatedRun[] = []
const REGEX_DEBOUNCE_MS = 250
const AROUND_RADIUS = 10
const MAX_AI_LINES = 200
/** ⌘ on macOS, Ctrl on Windows/Linux. */
const IS_MAC = isMacUserAgent(navigator.userAgent)
const NO_BOOKMARKS: ReadonlySet<number> = new Set()
const NOOP = () => {}
const EMPTY_SEARCH: SearchState = { text: '', regex: false, caseSensitive: false, exclude: '' }

export function App() {
  const [notice, setNotice] = useState<Notice>()
  const onError = useCallback((m: string) => setNotice(noticeFromError(m)), [])
  const nav = useNavigation(onError)
  const [now, setNow] = useState(() => Date.now())
  const [levels, setLevels] = useState<ReadonlySet<Level>>(new Set(LEVELS))
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH)
  const [presets, setPresets] = useState<NamespacePresets>()
  const [collapse, setCollapse] = useState(true)
  const [wrap, setWrap] = useState(false)
  const [showVolume, setShowVolume] = useState(true)
  const [timeRange, setTimeRange] = useState<readonly [number, number]>()
  const [groupKey, setGroupKey] = useState<string>()
  const [selectedGroups, setSelectedGroups] = useState<ReadonlySet<string>>(new Set())
  const [frozen, setFrozen] = useState<number>()
  const paused = frozen !== undefined
  const [regexMatches, setRegexMatches] = useState<ReadonlySet<number>>()
  const [regexError, setRegexError] = useState<string>()
  const [cursor, setCursor] = useState<number>()
  const [selectedSeq, setSelectedSeq] = useState<number>()
  const [bookmarks, setBookmarks] = useState<ReadonlySet<number>>(new Set())
  const [command, setCommand] = useState<{ cmd: ScrollCommand; nonce: number }>()
  const [tab, setTab] = useState<PanelTab>('erros')
  const [aiMode, setAiMode] = useState<AiContextMode>('grupos')
  const [aiStatus, setAiStatus] = useState<AiStatus>()
  const [aiPrefs, setAiPrefs] = useState(false)
  const [shortcuts, setShortcuts] = useState(false)
  const [bufferLines, setBufferLines] = useState(loadBufferLines)
  const [fileError, setFileError] = useState<{ problem: LogFileProblem; fileName: string }>()
  const [shell, setShell] = useState<ShellTarget>()
  const [theme, setTheme] = useState<ThemeId>(loadTheme)
  const [lang, setLang] = useState<Lang>(loadLanguage)
  const [prefs, setPrefs] = useState(false)
  const [recents, setRecents] = useState<RecentPod[]>(loadRecents)
  const [kubectlVersion, setKubectlVersion] = useState<string>()
  const [kubectlMissing, setKubectlMissing] = useState<string>()
  const updates = useUpdateCheck()
  const [updateOpen, setUpdateOpen] = useState(false)
  const t = useMemo(() => translator(lang), [lang])
  const searchRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const session = useLogTabs()
  const { engine, version, status } = session
  // Selection and log options belong to the active tab.
  const selection: Selection = session.activeTab.selection
  const options: LogOptions = session.activeTab.options
  const { setSelection, setOptions } = session
  const selectedContext = nav.contexts.find((c) => c.name === selection.context)
  // What the user sees for the context: their LogDeck alias, else the short derived label.
  const contextShown = selection.context ? (nav.aliases[selection.context]?.trim() || selection.context) : undefined
  const scroll = (cmd: ScrollCommand) => setCommand({ cmd, nonce: Date.now() })

  useEffect(() => applyTheme(theme), [theme])
  useEffect(() => {
    document.documentElement.lang = lang
    saveLanguage(lang)
    void window.logdeck.setLanguage(lang)
  }, [lang])

  // Shows what kubectl reported and loads the contexts; at startup and again from the "Check again" button.
  const applyKubectl = async (v: VersionInfo) => {
    if (!v.installed) {
      // A missing kubectl gets the install card on the welcome screen instead of a notice.
      if (v.missing && v.installHint) return setKubectlMissing(v.installHint)
      return setNotice(noticeFromError(v.message ?? ''))
    }
    setKubectlMissing(undefined)
    if (v.version) setKubectlVersion(v.version)
    try {
      const list = await window.logdeck.listContexts()
      nav.showContexts(list)
      if (list.length === 0) setNotice({ kind: 'noContexts', text: t('app.noContexts') })
    } catch (err) {
      setNotice(noticeFromError((err as Error).message))
    }
  }

  const loadKubectl = () => window.logdeck.kubectlVersion().then(applyKubectl)

  useEffect(() => {
    void window.logdeck.kubectlVersion().then(applyKubectl)
    void window.logdeck.aiStatus().then(setAiStatus)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // The log stream has delivered its first lines (or finished): extra kubectl reads may start.
  const logsSettled = engine.size > 0 || status?.state === 'ended' || status?.state === 'error'

  // Services, Routes and Ingresses of the tab's namespace (Pod tab → Access), read when a pod is opened.
  const [exposure, setExposure] = useState<{ key: string; value: Exposure }>()
  useEffect(() => {
    const { context, namespace, pod } = selection
    if (!context || !namespace || !pod || session.file) return
    const key = nsKey(context, namespace)
    if (exposure?.key === key && !logsSettled) return
    let alive = true
    const first = setTimeout(
      () =>
        void window.logdeck.listExposure(context, namespace).then(
          (value) => alive && setExposure({ key, value }),
          () => undefined,
        ),
      logsSettled ? 0 : EXTRAS_DELAY_MS,
    )
    return () => {
      alive = false
      clearTimeout(first)
    }
  }, [selection.context, selection.namespace, selection.pod?.name, session.file, logsSettled]) // eslint-disable-line react-hooks/exhaustive-deps

  // Kubernetes events of the tab's pod, refreshed with the pod list.
  const [podEvents, setPodEvents] = useState<{ key: string; events: PodEvent[] }>()
  useEffect(() => {
    const { context, namespace, pod } = selection
    if (!context || !namespace || !pod || session.file) return
    const key = `${context}::${namespace}::${pod.name}`
    let alive = true
    const load = () =>
      window.logdeck.listPodEvents(context, namespace, pod.name).then(
        (events) => alive && setPodEvents({ key, events }),
        () => undefined,
      )
    // The log's own kubectl goes first; events follow its first lines.
    const first = setTimeout(() => void load(), logsSettled ? 0 : EXTRAS_DELAY_MS)
    const timer = setInterval(() => {
      if (!document.hidden) void load()
    }, EVENTS_REFRESH_MS)
    return () => {
      alive = false
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [selection.context, selection.namespace, selection.pod?.name, session.file, logsSettled]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const { context, namespace } = selection
    if (!context || !namespace) return
    const timer = setInterval(() => {
      if (!document.hidden) void nav.loadPods(context, namespace).then(() => setNow(Date.now()))
    }, POD_REFRESH_MS)
    return () => clearInterval(timer)
  }, [selection.context, selection.namespace]) // eslint-disable-line react-hooks/exhaustive-deps

  const resetView = () => {
    setFrozen(undefined)
    setGroupKey(undefined)
    setSelectedGroups(new Set())
    setSelectedSeq(undefined)
    setBookmarks(new Set())
    setTimeRange(undefined)
    setCursor(undefined)
  }

  /** Tab switches restart the view state (selection, bookmarks, pause, group/time filters); presets follow the tab. */
  const afterTabChange = () => {
    resetView()
    setShell(undefined)
    const { context, namespace } = session.activeTab.selection
    setPresets(undefined)
    if (context && namespace) void window.logdeck.getPresets(presetKey(context, namespace)).then(setPresets)
  }

  const openLogs = (context: string, namespace: string, pod: PodInfo, container: string, o: LogOptions, tabId?: string) => {
    resetView()
    void session.stopCompare(tabId)
    setRecents((prev) => {
      const next = pushRecent(prev, { context, namespace, pod: pod.name, container })
      saveRecents(next)
      return next
    })
    // A finished pod (completed build, Job) is read once: following it would just reconnect over and over.
    const once = pod.phase === 'Succeeded' || pod.phase === 'Failed'
    void session.start(
      { context, namespace, pod: pod.name, container, tail: o.tail, ...(o.since && { since: o.since }), ...(o.previous && { previous: true }), ...(once && { once: true }) },
      tabId,
      // OKD build pods: RUN output has no format, show it as INFO instead of UNKNOWN
      pod.kind === 'build' ? { defaultLevel: 'INFO' } : {},
    )
  }

  const selectPod = async (context: string, namespace: string, pod: PodInfo, preferred?: string, inNewTab = false) => {
    let tabId: string | undefined
    if (inNewTab) {
      tabId = session.newTab()
      if (!tabId) return setNotice({ kind: 'tabsLimit', text: t('tabs.limit', { n: MAX_TABS }) })
    }
    setShell(undefined)
    if (selection.context !== context || selection.namespace !== namespace) setPresets(await window.logdeck.getPresets(presetKey(context, namespace)))
    const opts = { ...options, previous: options.previous && pod.canPrevious }
    const all = [...pod.containers, ...pod.initContainers]
    // OKD build/deployer pods: open the main container (the build itself), not the init steps (git-clone…)
    const main = pod.kind !== 'app' && pod.containers.length === 1 ? pod.containers[0] : undefined
    const container = preferred && all.includes(preferred) ? preferred : all.length === 1 ? all[0] : main
    setOptions(opts, tabId)
    if (container) {
      setSelection({ context, namespace, pod, container }, tabId)
      openLogs(context, namespace, pod, container, opts, tabId)
    } else {
      setSelection({ context, namespace, pod }, tabId)
      void session.stop(tabId)
    }
  }

  /** A build whose pod is gone: stop this tab's log and show the build details. */
  const openBuild = async (context: string, namespace: string, build: BuildInfo) => {
    setShell(undefined)
    resetView()
    await session.goHome()
    setSelection({ context, namespace, build })
  }

  const forgetRecent = (r: RecentPod) =>
    setRecents((prev) => {
      const next = prev.filter((x) => recentKey(x) !== recentKey(r))
      saveRecents(next)
      return next
    })

  /** Reopens a recent pod; pods recreated by a deployment get a new name, so it may be gone. */
  const openRecent = async (r: RecentPod) => {
    await nav.openNamespace(r.context, r.namespace, true)
    const pods = await nav.loadPods(r.context, r.namespace)
    const pod = pods?.find((p) => p.name === r.pod)
    if (!pod) {
      const next = pods && findReplacement(r.pod, r.container, pods)
      if (!next) return setNotice({ kind: 'recentGone', text: t('recent.gone', { pod: r.pod }) })
      return setNotice({
        kind: 'recentGone',
        text: t('recent.replaced', { pod: r.pod, next: next.name }),
        action: {
          label: t('recent.openReplacement'),
          run: () => {
            setNotice(undefined)
            forgetRecent(r)
            void selectPod(r.context, r.namespace, next, r.container)
          },
        },
      })
    }
    await selectPod(r.context, r.namespace, pod, r.container)
  }

  const selectContainer = (c: string) => {
    const { context, namespace, pod } = selection
    if (!context || !namespace || !pod) return
    setSelection({ ...selection, container: c })
    openLogs(context, namespace, pod, c, options)
  }

  const openFile = async (f: File) => {
    setShell(undefined)
    resetView()
    try {
      await session.openFile(f)
    } catch (err) {
      // The user just picked this file: the reason gets a dialog, not the thin notice on top (issue #24).
      if (err instanceof LogFileError) setFileError({ problem: err.problem, fileName: err.fileName })
      else setNotice(noticeFromError((err as Error).message))
    }
  }

  // Dropping a file anywhere on the window opens it (navigation is blocked in main).
  useEffect(() => {
    const over = (e: DragEvent) => e.preventDefault()
    const drop = (e: DragEvent) => {
      e.preventDefault()
      const f = e.dataTransfer?.files[0]
      if (f) void openFile(f)
    }
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
    }
  })

  const reopen = (o: LogOptions = options) => {
    const { context, namespace, pod, container } = selection
    if (context && namespace && pod && container) openLogs(context, namespace, pod, container, o)
  }

  const savePresets = async (p: NamespacePresets) => {
    if (!selection.context || !selection.namespace) return
    setPresets(await window.logdeck.setPresets(presetKey(selection.context, selection.namespace), p))
  }

  const excludeTerms = useMemo(() => [...parseTerms(search.exclude), ...(presets ? activeTerms(presets) : [])], [search.exclude, presets])
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
    const timer = setTimeout(() => {
      const entries = engine.entries()
      void searchWithTimeout(entries.map(entryText), { text: search.text, mode: 'regex', caseSensitive: search.caseSensitive }, { runner: browserRegexRunner, timeoutMs: 250 }).then((r) => {
        if (r.status === 'ok') {
          setRegexError(undefined)
          setRegexMatches(new Set(r.matches.map((i) => entries[i]!.seq)))
        } else {
          setRegexMatches(new Set())
          setRegexError(r.status === 'timeout' ? t('app.regexTimeout') : r.message)
        }
      })
    }, REGEX_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [regexActive, search.text, search.caseSensitive, version, engine, t])

  const groups = useMemo(() => engine.groups(), [engine, version]) // eslint-disable-line react-hooks/exhaustive-deps
  const groupSeqs = useMemo(() => {
    const g = groups.find((x) => x.key === groupKey)
    return g ? new Set(g.seqs) : undefined
  }, [groups, groupKey])

  const viewVersion = frozen ?? version
  const effectiveRegex = useMemo(() => (regexActive ? (regexMatches ?? new Set<number>()) : undefined), [regexActive, regexMatches])
  const baseFilter = useMemo(
    () => ({ levels, ...(compiled && { search: compiled }), ...(effectiveRegex && { regexMatches: effectiveRegex }), ...(groupSeqs && { groupSeqs }) }),
    [levels, compiled, effectiveRegex, groupSeqs],
  )
  const histogramEntries = useMemo(
    () => (showVolume ? engine.view({ ...baseFilter, collapse: false }).map((r) => r.entry) : []),
    [engine, viewVersion, baseFilter, showVolume], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const rows = useMemo(
    () => engine.view({ ...baseFilter, ...(timeRange && { timeRange }), collapse }),
    [engine, viewVersion, baseFilter, timeRange, collapse], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const counts = useMemo(() => engine.counts, [engine, version]) // eslint-disable-line react-hooks/exhaustive-deps
  // --previous side by side: same level and text filters (group/regex/time filters are tied to the main log's lines).
  const companion = session.companion
  const previousRows = useMemo(
    () => (companion ? companion.engine.view({ levels, ...(compiled && { search: compiled }), collapse }) : []),
    [companion, version, levels, compiled, collapse], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const canCompare = Boolean(selection.pod?.canPrevious && selection.container && !options.previous)
  const toggleCompare = () => {
    const { context, namespace, pod, container } = selection
    if (session.activeTab.compare) return void session.stopCompare()
    if (context && namespace && pod && container) void session.startCompare({ context, namespace, pod: pod.name, container, tail: options.tail })
  }
  const entriesBySeq = useMemo(() => new Map(engine.entries().map((e) => [e.seq, e])), [engine, version]) // eslint-disable-line react-hooks/exhaustive-deps
  const selectedEntry = selectedSeq !== undefined ? entriesBySeq.get(selectedSeq) : undefined
  const bookmarkedEntries = [...bookmarks].flatMap((s) => {
    const e = entriesBySeq.get(s)
    return e ? [e] : []
  })

  // The tab's pod as of the last sidebar refresh (every few seconds), for the Pod tab, uptime and restart marks.
  const livePod = useMemo(() => {
    const { context, namespace, pod } = selection
    if (session.file || !context || !namespace || !pod) return undefined
    return nav.pods[nsKey(context, namespace)]?.find((p) => p.name === pod.name) ?? pod
  }, [nav.pods, selection, session.file])
  const liveContainer = containerDetail(livePod, selection.container)
  const runs = (livePod && selection.context && selection.container && nav.runs[runsKey(selection.context, livePod.namespace, livePod.name, selection.container)]) || NO_RUNS
  const upMs = uptime(liveContainer, now)
  const access = useMemo(
    () => (livePod && selection.context && exposure?.key === nsKey(selection.context, livePod.namespace) ? podAccess(livePod.labels, exposure.value) : undefined),
    [livePod, exposure, selection.context],
  )

  // Empty view with lines loaded: tell how many the presets hide (often health checks filling the tail).
  const hidden = useMemo(() => {
    if (rows.length > 0 || engine.size === 0) return undefined
    const terms = presets ? activeTerms(presets) : []
    return { loaded: engine.size, byPresets: terms.length > 0 ? countExcluded(engine.entries(), terms) : 0 }
  }, [rows.length, engine, presets, viewVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Marks between lines (stream drops, silence, restarts); hidden while searching or showing one error group.
  const marksShown = search.text === '' && !groupKey
  const allMarks = useMemo(() => {
    if (!marksShown) return []
    const restarts = liveContainer ? restartMarks(liveContainer.name, runs.length > 0 ? runs : liveContainer.last ? [liveContainer.last] : []) : []
    const events = livePod && podEvents?.key === `${selection.context}::${livePod.namespace}::${livePod.name}` ? eventMarks(podEvents.events, selection.container) : []
    return [...session.marks, ...quietMarks(engine.entries()), ...restarts, ...events]
  }, [marksShown, liveContainer, runs, session.marks, engine, viewVersion, livePod, podEvents, selection.context, selection.container]) // eslint-disable-line react-hooks/exhaustive-deps
  const placedMarks = useMemo(() => placeMarks(rows, allMarks, timeRange), [rows, allMarks, timeRange])

  const filtersActive = levels.size !== LEVELS.length || search.text !== '' || search.exclude !== '' || !!timeRange || !!groupKey
  const clearFilters = () => {
    setLevels(new Set(LEVELS))
    setSearch(EMPTY_SEARCH)
    setTimeRange(undefined)
    setGroupKey(undefined)
    setCursor(undefined)
  }

  const toggleLevel = (l: Level, solo: boolean) => {
    if (solo) return setLevels(new Set([l]))
    const next = new Set(levels)
    if (next.has(l)) next.delete(l)
    else next.add(l)
    setLevels(next)
  }

  const pause = () => setFrozen((f) => f ?? version)
  const resume = () => {
    setFrozen(undefined)
    scroll({ kind: 'bottom' })
  }
  const selectEntry = (seq: number) => {
    setSelectedSeq(seq)
    pause()
    setTab('detalhes')
  }
  const toggleBookmark = (seq: number) =>
    setBookmarks((prev) => {
      const next = new Set(prev)
      if (next.has(seq)) next.delete(seq)
      else next.add(seq)
      return next
    })

  const exportRows = () => {
    const text = engine
      .view({ ...baseFilter, ...(timeRange && { timeRange }), collapse: false })
      .map((r) => entryText(r.entry))
      .join('\n')
    void window.logdeck.saveText(text, `logdeck-${selection.pod?.name ?? session.file?.replace(/\.[^.]+$/, '') ?? 'log'}.log`)
  }

  const buildContext = (mode: AiContextMode): ExplainGroupInput[] => {
    if (mode === 'linha' && selectedSeq !== undefined) return [aroundEntry(engine.entries(), selectedSeq, AROUND_RADIUS)]
    if (mode === 'visiveis') return [visibleLines(rows.map((r) => r.entry), MAX_AI_LINES)]
    return groups
      .filter((g) => selectedGroups.has(g.key))
      .map((g) => ({
        title: groupTitle(t, g),
        count: g.count,
        lines: g.seqs.flatMap((seq) => {
          const e = entriesBySeq.get(seq)
          return e ? [entryText(e)] : []
        }),
      }))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement
      const mod = IS_MAC ? e.metaKey : e.ctrlKey
      if (mod && e.key === 'o') {
        e.preventDefault()
        fileRef.current?.click()
      } else if (mod && e.key === 'f') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      } else if (mod && e.key === 'g' && rows.length > 0) {
        e.preventDefault()
        setFrozen((f) => f ?? version)
        setCursor((c) => (c === undefined ? (e.shiftKey ? rows.length - 1 : 0) : (c + (e.shiftKey ? rows.length - 1 : 1)) % rows.length))
      } else if (e.key === 'Escape') {
        setSelectedSeq(undefined)
        setShortcuts(false)
        setUpdateOpen(false)
        setFileError(undefined)
      } else if (e.key === '?' && !typing) {
        setShortcuts(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rows.length, version])

  // Empty tab: welcome screen instead of the log views, and no right panel.
  const showingBuild = !!selection.build && !selection.pod
  const isEmptyTab = !selection.pod && !session.file && !showingBuild
  const live = status?.state === 'live' || status?.state === 'reconnecting'
  return (
    <I18nProvider lang={lang}>
    <div className="app">
      {notice && <NoticeBar key={notice.text} notice={notice} onClose={() => setNotice(undefined)} />}
      <input
        ref={fileRef}
        type="file"
        hidden
        aria-label={t('app.fileInput')}
        accept=".log,.txt,.json,.out,text/*"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void openFile(f)
        }}
      />
      <div className={`layout ${isEmptyTab || showingBuild ? 'no-panel' : ''}`}>
        <Sidebar
          nav={nav}
          selection={selection}
          onPod={(c, n, p, inNewTab) => void selectPod(c, n, p, undefined, inNewTab)}
          onBuild={(c, n, b) => void openBuild(c, n, b)}
          onContainer={selectContainer}
          bookmarks={bookmarkedEntries}
          onBookmark={(seq) => {
            selectEntry(seq)
            scroll({ kind: 'seq', seq })
          }}
          shellOpen={!!shell}
          onCloseShell={() => setShell(undefined)}
          now={now}
          onPreferences={() => setPrefs(true)}
          recents={recents}
          onRecent={(r) => void openRecent(r)}
          onForgetRecent={forgetRecent}
          onAiPreferences={() => setAiPrefs(true)}
          onShortcuts={() => setShortcuts(true)}
          onOpenFile={() => fileRef.current?.click()}
          {...(session.file && { fileName: session.file })}
        />
        <main className="main">
          <TabBar
            tabs={session.tabs}
            active={session.activeTab.id}
            onActivate={(id) => {
              session.activate(id)
              afterTabChange()
            }}
            onClose={(id) => {
              void session.close(id)
              afterTabChange()
            }}
            homeActive={isEmptyTab}
            onHome={() => {
              if (!session.openHome()) return setNotice({ kind: 'tabsLimit', text: t('tabs.limit', { n: MAX_TABS }) })
              afterTabChange()
            }}
          />
          {showingBuild && selection.build && selection.namespace ? (
            <BuildDetails namespace={selection.namespace} build={selection.build} />
          ) : isEmptyTab ? (
            <Welcome
              contexts={nav.visible.length}
              {...(nav.activeContext && { currentContext: displayLabel(nav.activeContext, nav.aliases).title })}
              {...(kubectlVersion && { kubectl: kubectlVersion })}
              {...(kubectlMissing && { kubectlMissing })}
              onCopyHint={(hint) => void window.logdeck.copyText(hint)}
              onRecheckKubectl={() => void loadKubectl()}
              {...(recents[0] && { lastRecent: recents[0] })}
              onPods={() => document.getElementById('pod-search')?.focus()}
              onFile={() => fileRef.current?.click()}
              onRecent={(r) => void openRecent(r)}
              askUpdates={updates.consent === null}
              onUpdates={(on) => updates.setConsent(on ? 'on' : 'off')}
            />
          ) : (
            <>
          <TopBar
            search={search}
            onSearch={(s) => {
              setSearch(s)
              setCursor(undefined)
            }}
            inputRef={searchRef}
            matchCount={rows.length}
            {...(regexActive && regexError && { error: regexError })}
            options={options}
            onOptions={(o) => {
              setOptions(o)
              reopen(o)
            }}
            canPrevious={selection.pod?.canPrevious ?? false}
            canReconnect={!!selection.container}
            onReconnect={() => reopen()}
            {...(presets && { presets })}
            onPresets={(p) => void savePresets(p)}
            {...(timeRange && { timeRange })}
            onClearTimeRange={() => setTimeRange(undefined)}
            filtersActive={filtersActive}
            onClearFilters={clearFilters}
            trailing={<StreamControl paused={paused} pending={0} live={live} onFollow={() => (paused ? resume() : pause())} />}
          />
          <LevelBar
            counts={counts}
            levels={levels}
            onToggle={toggleLevel}
            onAll={() => setLevels(new Set(LEVELS))}
            showVolume={showVolume}
            onVolume={() => setShowVolume((v) => !v)}
            collapse={collapse}
            onCollapse={() => setCollapse((c) => !c)}
            wrap={wrap}
            onWrap={() => setWrap((w) => !w)}
            onExport={exportRows}
            onClear={() => {
              engine.clear()
              resetView()
            }}
            canCompare={canCompare}
            compare={!!session.activeTab.compare}
            onCompare={toggleCompare}
            canShell={Boolean(selection.pod && selection.container && !selection.pod.initContainers.includes(selection.container))}
            onShell={() => {
              const { context, namespace, pod, container } = selection
              if (context && namespace && pod && container) setShell({ context, namespace, pod: pod.name, container })
            }}
          />
          {showVolume && <VolumeChart entries={histogramEntries} marks={allMarks} {...(timeRange && { range: timeRange })} onRange={setTimeRange} onClose={() => setShowVolume(false)} />}
          {(() => {
            const main = (
              <LogList
                rows={rows}
                {...(highlightSearch && { search: highlightSearch })}
                {...(cursor !== undefined && { cursor })}
                {...(selectedSeq !== undefined && { selectedSeq })}
                bookmarks={bookmarks}
                wrap={wrap}
                paused={paused}
                {...(command && { command })}
                onSelect={selectEntry}
                onBookmark={toggleBookmark}
                onUserScrollUp={pause}
                onResume={resume}
                marks={placedMarks}
                dropped={{ n: engine.dropped, capacity: engine.capacity }}
                live={!session.file}
                {...(canCompare && !session.activeTab.compare && { onPrevious: toggleCompare })}
                {...(hidden && { hidden })}
                onPresetsOff={() => presets && void savePresets({ ...presets, active: [] })}
                onClearFilters={clearFilters}
              />
            )
            if (!companion) return main
            return (
              <div className="log-split">
                <div className="log-pane">
                  <div className="pane-head">{t('cmp.current')}</div>
                  {main}
                </div>
                <div className="log-pane" data-testid="previous-pane">
                  <div className="pane-head">
                    {t('cmp.previous')}
                    <span className="spacer" />
                    <span>{t('st.lines', { shown: previousRows.length, total: companion.engine.size })}</span>
                  </div>
                  <LogList
                    label={t('cmp.previous')}
                    rows={previousRows}
                    {...(highlightSearch && { search: highlightSearch })}
                    bookmarks={NO_BOOKMARKS}
                    wrap={wrap}
                    paused={false}
                    markable={false}
                    onSelect={NOOP}
                    onBookmark={NOOP}
                    onUserScrollUp={NOOP}
                    onResume={NOOP}
                  />
                </div>
              </div>
            )
          })()}
          {shell && <ShellPanel target={shell} onClose={() => setShell(undefined)} />}
            </>
          )}
        </main>
        {!isEmptyTab && !showingBuild && (
        <RightPanel
          tab={tab === 'pod' && !livePod ? 'erros' : tab}
          onTab={setTab}
          groups={groups}
          {...(groupKey && { activeGroup: groupKey })}
          onGroup={setGroupKey}
          selectedGroups={selectedGroups}
          onToggleGroup={(k) => {
            const next = new Set(selectedGroups)
            if (next.has(k)) next.delete(k)
            else next.add(k)
            setSelectedGroups(next)
          }}
          {...(selectedEntry && { entry: selectedEntry })}
          bookmarked={selectedSeq !== undefined && bookmarks.has(selectedSeq)}
          onBookmark={toggleBookmark}
          visibleCount={rows.length}
          {...(aiStatus && { aiStatus })}
          aiMode={aiMode}
          onAiMode={setAiMode}
          buildContext={buildContext}
          onAiPreferences={() => setAiPrefs(true)}
          {...(livePod && { pod: livePod })}
          {...(selection.container && { container: selection.container })}
          runs={runs}
          now={now}
          {...(access && { access })}
          ticketSource={
            session.file
              ? { file: session.file }
              : {
                  ...(contextShown && { context: contextShown }),
                  ...(selection.namespace && { namespace: selection.namespace }),
                  ...(selection.pod && { pod: selection.pod.name }),
                  ...(selection.container && { container: selection.container }),
                }
          }
        />
        )}
      </div>
      <StatusBar {...(status && { status })} paused={paused} selection={selection} shown={rows.length} total={engine.size} dropped={engine.dropped} aiLabel={aiLabel(t, aiStatus)} {...(session.file && { file: session.file })} {...(contextShown && { contextName: contextShown })} production={!!selectedContext?.production && !session.file} {...(updates.available && { update: updates.available })} onUpdate={() => setUpdateOpen(true)} {...(upMs !== undefined && liveContainer && { uptime: { ms: upMs, container: liveContainer.name, restarts: liveContainer.restarts } })} />
      {aiPrefs && (
        <AiPreferences
          onClose={() => {
            setAiPrefs(false)
            void window.logdeck.aiStatus().then(setAiStatus)
          }}
        />
      )}
      {shortcuts && <ShortcutsModal onClose={() => setShortcuts(false)} />}
      {fileError && (
        <FileErrorModal
          {...fileError}
          mb={MAX_LOG_FILE_BYTES / 1024 / 1024}
          onClose={() => setFileError(undefined)}
          onOpenOther={() => {
            setFileError(undefined)
            fileRef.current?.click()
          }}
        />
      )}
      {prefs && (
        <PreferencesModal
          theme={theme}
          onTheme={setTheme}
          lang={lang}
          onLang={setLang}
          updates={updates.consent === 'on'}
          onUpdates={(on) => updates.setConsent(on ? 'on' : 'off')}
          bufferLines={bufferLines}
          onBufferLines={(n) => {
            setBufferLines(n)
            saveBufferLines(n)
          }}
          onClose={() => setPrefs(false)}
        />
      )}
      {updateOpen && updates.available && (
        <UpdateModal
          version={updates.available}
          onSkip={() => {
            if (updates.available) updates.skip(updates.available)
            setUpdateOpen(false)
          }}
          onClose={() => setUpdateOpen(false)}
        />
      )}
    </div>
    </I18nProvider>
  )
}
