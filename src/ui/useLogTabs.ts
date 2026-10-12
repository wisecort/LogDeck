import { useCallback, useEffect, useRef, useState } from 'react'
import { checkLogFile, LogFileError, splitLogText } from '../logs/file'
import type { Level } from '../logs/types'
import type { StartLogsRequest, StreamStatus } from '../shared/ipc'
import type { LogOptions, Selection } from './view-types'
import { LogEngine } from './engine'
import { activateTab, addTab, closeTab, companionKey, initialTabs, updateTab, type TabsState } from './tabs'

const RENDER_MS = 100
const FILE_CHUNK = 5000

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** One engine and (at most) one stream per tab. */
interface Slot {
  engine: LogEngine
  streamId?: string
  /** Bumped on every start/stop so a late startLogs answer for an old stream is ignored. */
  generation: number
  status?: StreamStatus
}

/**
 * Several log sessions (live streams or files), one per tab. Lines are routed to the tab that owns the
 * stream even when it is in the background; only the active tab re-renders, at most every 100 ms (RNF5).
 */
export function useLogTabs() {
  const [state, setState] = useState<TabsState>(initialTabs)
  // Refs mirror the state so calls made in the same tick (new tab, then start) target the right tab.
  const stateRef = useRef(state)
  // One mutable map for the whole hook (state slot keeps the identity; it is read during render).
  const [slots] = useState(() => new Map<string, Slot>())
  const byStream = useRef(new Map<string, string>())
  // Events that arrive before startLogs resolves with the id.
  const early = useRef(new Map<string, string[][]>())
  const earlyStatus = useRef(new Map<string, StreamStatus>())
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [version, setVersion] = useState(0)
  const [, setStatusTick] = useState(0)

  const commit = useCallback((next: TabsState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const slot = useCallback((tabId: string): Slot => {
    let s = slots.get(tabId)
    if (!s) {
      s = { engine: new LogEngine(), generation: 0 }
      slots.set(tabId, s)
    }
    return s
  }, [slots])

  /** The active tab and its --previous companion re-render; background tabs only ingest. */
  const isVisible = (key: string) => key === stateRef.current.active || key === companionKey(stateRef.current.active)

  const scheduleRender = useCallback(() => {
    timer.current ??= setTimeout(() => {
      timer.current = undefined
      setVersion((v) => v + 1)
    }, RENDER_MS)
  }, [])

  useEffect(() => {
    const offLines = window.logdeck.onLogLines(({ streamId, lines }) => {
      const tabId = byStream.current.get(streamId)
      if (tabId === undefined) {
        early.current.set(streamId, [...(early.current.get(streamId) ?? []), lines])
        return
      }
      slot(tabId).engine.ingest(lines)
      if (isVisible(tabId)) scheduleRender()
    })
    const offStatus = window.logdeck.onLogStatus(({ streamId, status }) => {
      const tabId = byStream.current.get(streamId)
      if (tabId === undefined) {
        earlyStatus.current.set(streamId, status)
        return
      }
      slot(tabId).status = status
      if (isVisible(tabId)) setStatusTick((n) => n + 1)
    })
    return () => {
      offLines()
      offStatus()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [scheduleRender, slot])

  const stop = useCallback(async (tabId: string = stateRef.current.active) => {
    const s = slots.get(tabId)
    if (!s) return
    s.generation++
    const id = s.streamId
    s.streamId = undefined
    if (id) {
      byStream.current.delete(id)
      await window.logdeck.stopLogs(id)
    }
  }, [slots])

  const start = useCallback(
    async (request: StartLogsRequest, tabId: string = stateRef.current.active, opts: { defaultLevel?: Level } = {}) => {
      await stop(tabId)
      const s = slot(tabId)
      const generation = s.generation
      s.engine.clear(opts.defaultLevel)
      s.status = { state: 'connecting' }
      commit(updateTab(stateRef.current, tabId, { file: undefined }))
      setVersion((v) => v + 1)
      try {
        const id = await window.logdeck.startLogs(request)
        if (s.generation !== generation || !slots.has(tabId)) {
          // stopped or closed meanwhile
          await window.logdeck.stopLogs(id)
          return
        }
        s.streamId = id
        byStream.current.set(id, tabId)
        for (const lines of early.current.get(id) ?? []) s.engine.ingest(lines)
        const latest = earlyStatus.current.get(id)
        if (latest) s.status = latest
        early.current.delete(id)
        earlyStatus.current.delete(id)
        scheduleRender()
      } catch (err) {
        s.status = { state: 'error', message: (err as Error).message }
        setStatusTick((n) => n + 1)
      }
    },
    [stop, slot, commit, scheduleRender, slots],
  )

  /** Loads a user-picked file into the tab; throws a LogFileError when it cannot be opened. */
  const openFile = useCallback(
    async (f: File, tabId: string = stateRef.current.active) => {
      await stop(tabId)
      const tooBig = checkLogFile(f, '')
      if (tooBig) throw new LogFileError(tooBig, f.name)
      const text = await f.text()
      const problem = checkLogFile(f, text)
      if (problem) throw new LogFileError(problem, f.name)
      const s = slot(tabId)
      s.engine.clear()
      s.status = undefined
      commit(updateTab(stateRef.current, tabId, { file: f.name, selection: {} }))
      const lines = splitLogText(text)
      for (let i = 0; i < lines.length; i += FILE_CHUNK) {
        s.engine.ingest(lines.slice(i, i + FILE_CHUNK))
        setVersion((v) => v + 1)
        await yieldToUi()
      }
      setVersion((v) => v + 1)
    },
    [stop, slot, commit],
  )

  /** Returns the new tab id, or undefined at the limit. */
  const newTab = useCallback((): string | undefined => {
    const next = addTab(stateRef.current)
    if (!next) return undefined
    commit(next)
    setVersion((v) => v + 1)
    return next.active
  }, [commit])

  /** Back to the welcome screen in this tab: stops its streams and forgets the pod/file. */
  const goHome = useCallback(
    async (tabId: string = stateRef.current.active) => {
      await stop(tabId)
      await stop(companionKey(tabId))
      slots.get(tabId)?.engine.clear()
      const s = slots.get(tabId)
      if (s) s.status = undefined
      commit(updateTab(stateRef.current, tabId, { selection: {}, file: undefined, compare: false }))
      setVersion((v) => v + 1)
    },
    [stop, commit, slots],
  )

  const close = useCallback(
    async (tabId: string) => {
      await stop(tabId)
      await stop(companionKey(tabId))
      slots.delete(tabId)
      slots.delete(companionKey(tabId))
      commit(closeTab(stateRef.current, tabId))
      setVersion((v) => v + 1)
    },
    [stop, commit, slots],
  )

  const activate = useCallback(
    (tabId: string) => {
      commit(activateTab(stateRef.current, tabId))
      setVersion((v) => v + 1)
    },
    [commit],
  )

  const setSelection = useCallback(
    (selection: Selection, tabId: string = stateRef.current.active) => commit(updateTab(stateRef.current, tabId, { selection })),
    [commit],
  )
  const setOptions = useCallback(
    (options: LogOptions, tabId: string = stateRef.current.active) => commit(updateTab(stateRef.current, tabId, { options })),
    [commit],
  )

  /** Starts the --previous stream next to the tab's log. */
  const startCompare = useCallback(
    async (request: StartLogsRequest, tabId: string = stateRef.current.active) => {
      commit(updateTab(stateRef.current, tabId, { compare: true }))
      await start({ ...request, previous: true }, companionKey(tabId))
    },
    [commit, start],
  )

  const stopCompare = useCallback(
    async (tabId: string = stateRef.current.active) => {
      if (stateRef.current.tabs.find((t) => t.id === tabId)?.compare) commit(updateTab(stateRef.current, tabId, { compare: false }))
      await stop(companionKey(tabId))
      slots.get(companionKey(tabId))?.engine.clear()
      setVersion((v) => v + 1)
    },
    [commit, stop, slots],
  )

  const activeTab = state.tabs.find((t) => t.id === state.active) ?? state.tabs[0]!
  const activeSlot = slot(activeTab.id)
  const companionSlot = activeTab.compare ? slot(companionKey(activeTab.id)) : undefined
  return {
    tabs: state.tabs,
    activeTab,
    engine: activeSlot.engine,
    // version changes on every ingest for the active tab and on tab switches (engine identity changes too)
    version: version + activeSlot.engine.version + (companionSlot?.engine.version ?? 0),
    companion: companionSlot && { engine: companionSlot.engine, status: companionSlot.status },
    startCompare,
    stopCompare,
    status: activeSlot.status,
    file: activeTab.file,
    start,
    stop,
    openFile,
    newTab,
    goHome,
    close,
    activate,
    setSelection,
    setOptions,
  }
}

export type LogTabs = ReturnType<typeof useLogTabs>
