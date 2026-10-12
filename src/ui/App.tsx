import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { compileSearch, entryText, searchWithTimeout, type CompiledSearch } from '../logs/search'
import { LEVELS, type Level } from '../logs/types'
import type { ExplainGroupInput } from '../shared/ai'
import type { AiStatus } from '../shared/ai-settings'
import type { PodInfo } from '../shared/ipc'
import { activeTerms, presetKey, type NamespacePresets } from '../shared/presets'
import { aroundEntry, visibleLines } from './ai-context'
import { AiPreferences } from './components/AiPreferences'
import { LevelBar } from './components/LevelBar'
import { LogList, type ScrollCommand } from './components/LogList'
import { ProdBanner } from './components/ProdBanner'
import { aiLabel, RightPanel, type AiContextMode, type PanelTab } from './components/RightPanel'
import { ShellPanel, type ShellTarget } from './components/ShellPanel'
import { ShortcutsModal } from './components/ShortcutsModal'
import { Sidebar, type Selection } from './components/Sidebar'
import { StatusBar } from './components/StatusBar'
import { TopBar, type LogOptions, type SearchState } from './components/TopBar'
import { VolumeChart } from './components/VolumeChart'
import { parseTerms } from './format'
import { browserRegexRunner } from './regex-runner'
import { isMacUserAgent } from '../platform/keys'
import { I18nProvider, loadLanguage, saveLanguage, translator, type Lang } from './i18n'
import { LogFileError, MAX_LOG_FILE_BYTES } from '../logs/file'
import { PreferencesModal } from './components/PreferencesModal'
import { applyTheme, loadTheme, type ThemeId } from './theme'
import { useLogSession } from './useLogSession'
import { useNavigation } from './useNavigation'
import { groupTitle } from './group-title'
import { loadRecents, pushRecent, saveRecents, type RecentPod } from './recents'

const POD_REFRESH_MS = 5000
const REGEX_DEBOUNCE_MS = 250
const AROUND_RADIUS = 10
const MAX_AI_LINES = 200
/** ⌘ on macOS, Ctrl on Windows/Linux. */
const IS_MAC = isMacUserAgent(navigator.userAgent)
const EMPTY_SEARCH: SearchState = { text: '', regex: false, caseSensitive: false, exclude: '' }

export function App() {
  const [notice, setNotice] = useState<string>()
  const onError = useCallback((m: string) => setNotice(m), [])
  const nav = useNavigation(onError)
  const [selection, setSelection] = useState<Selection>({})
  const [options, setOptions] = useState<LogOptions>({ tail: 1000, since: '', previous: false })
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
  const [shell, setShell] = useState<ShellTarget>()
  const [theme, setTheme] = useState<ThemeId>(loadTheme)
  const [lang, setLang] = useState<Lang>(loadLanguage)
  const [prefs, setPrefs] = useState(false)
  const [recents, setRecents] = useState<RecentPod[]>(loadRecents)
  const t = useMemo(() => translator(lang), [lang])
  const searchRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const session = useLogSession()
  const { engine, version, status } = session
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

  useEffect(() => {
    void (async () => {
      const v = await window.logdeck.kubectlVersion()
      if (!v.installed) return setNotice(v.message)
      try {
        const list = await window.logdeck.listContexts()
        nav.showContexts(list)
        if (list.length === 0) setNotice(t('app.noContexts'))
      } catch (err) {
        setNotice((err as Error).message)
      }
    })()
    void window.logdeck.aiStatus().then(setAiStatus)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const openLogs = (context: string, namespace: string, pod: PodInfo, container: string, o: LogOptions) => {
    resetView()
    setRecents((prev) => {
      const next = pushRecent(prev, { context, namespace, pod: pod.name, container })
      saveRecents(next)
      return next
    })
    void session.start({ context, namespace, pod: pod.name, container, tail: o.tail, ...(o.since && { since: o.since }), ...(o.previous && { previous: true }) })
  }

  const selectPod = async (context: string, namespace: string, pod: PodInfo, preferred?: string) => {
    setShell(undefined)
    if (selection.context !== context || selection.namespace !== namespace) setPresets(await window.logdeck.getPresets(presetKey(context, namespace)))
    const opts = { ...options, previous: options.previous && pod.canPrevious }
    setOptions(opts)
    const all = [...pod.containers, ...pod.initContainers]
    const container = preferred && all.includes(preferred) ? preferred : all.length === 1 ? all[0] : undefined
    if (container) {
      setSelection({ context, namespace, pod, container })
      openLogs(context, namespace, pod, container, opts)
    } else {
      setSelection({ context, namespace, pod })
      void session.stop()
    }
  }

  /** Reopens a recent pod; pods recreated by a deployment get a new name, so it may be gone. */
  const openRecent = async (r: RecentPod) => {
    await nav.openNamespace(r.context, r.namespace, true)
    const pod = (await nav.loadPods(r.context, r.namespace))?.find((p) => p.name === r.pod)
    if (!pod) return setNotice(t('recent.gone', { pod: r.pod }))
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
    setSelection({})
    resetView()
    try {
      await session.openFile(f)
    } catch (err) {
      setNotice(
        err instanceof LogFileError
          ? t(`file.${err.problem}`, { name: err.fileName, mb: MAX_LOG_FILE_BYTES / 1024 / 1024 })
          : (err as Error).message,
      )
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
  const entriesBySeq = useMemo(() => new Map(engine.entries().map((e) => [e.seq, e])), [engine, version]) // eslint-disable-line react-hooks/exhaustive-deps
  const selectedEntry = selectedSeq !== undefined ? entriesBySeq.get(selectedSeq) : undefined
  const bookmarkedEntries = [...bookmarks].flatMap((s) => {
    const e = entriesBySeq.get(s)
    return e ? [e] : []
  })

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
      } else if (e.key === '?' && !typing) {
        setShortcuts(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rows.length, version])

  const live = status?.state === 'live' || status?.state === 'reconnecting'
  return (
    <I18nProvider lang={lang}>
    <div className="app">
      {selectedContext?.production && <ProdBanner context={contextShown ?? selectedContext.name} />}
      {notice && (
        <div className="notice" role="status">
          <span className="spacer">{notice}</span>
          <button className="link" onClick={() => setNotice(undefined)}>
            ×
          </button>
        </div>
      )}
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
      <div className="layout">
        <Sidebar
          nav={nav}
          selection={selection}
          onPod={(c, n, p) => void selectPod(c, n, p)}
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
          onAiPreferences={() => setAiPrefs(true)}
          onShortcuts={() => setShortcuts(true)}
          onOpenFile={() => fileRef.current?.click()}
          {...(session.file && { fileName: session.file })}
        />
        <main className="main">
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
            canShell={Boolean(selection.pod && selection.container && !selection.pod.initContainers.includes(selection.container))}
            onShell={() => {
              const { context, namespace, pod, container } = selection
              if (context && namespace && pod && container) setShell({ context, namespace, pod: pod.name, container })
            }}
            paused={paused}
            pending={0}
            live={live}
            onFollow={() => (paused ? resume() : pause())}
          />
          {showVolume && <VolumeChart entries={histogramEntries} {...(timeRange && { range: timeRange })} onRange={setTimeRange} onClose={() => setShowVolume(false)} />}
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
          />
          {shell && <ShellPanel target={shell} onClose={() => setShell(undefined)} />}
        </main>
        <RightPanel
          tab={tab}
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
      </div>
      <StatusBar {...(status && { status })} paused={paused} selection={selection} shown={rows.length} total={engine.size} dropped={engine.dropped} aiLabel={aiLabel(t, aiStatus)} {...(session.file && { file: session.file })} {...(contextShown && { contextName: contextShown })} />
      {aiPrefs && (
        <AiPreferences
          onClose={() => {
            setAiPrefs(false)
            void window.logdeck.aiStatus().then(setAiStatus)
          }}
        />
      )}
      {shortcuts && <ShortcutsModal onClose={() => setShortcuts(false)} />}
      {prefs && <PreferencesModal theme={theme} onTheme={setTheme} lang={lang} onLang={setLang} onClose={() => setPrefs(false)} />}
    </div>
    </I18nProvider>
  )
}
