import { useCallback, useEffect, useRef, useState } from 'react'
import { checkLogFile, LogFileError, MAX_LOG_FILE_BYTES, MAX_LOG_FILE_LINES, readLogLines } from '../logs/file'
import { trackReconnect, type Mark } from '../logs/marks'
import type { Level } from '../logs/types'
import type { StartLogsRequest, StreamStatus } from '../shared/ipc'
import type { LogOptions, Selection } from './view-types'
import { loadBufferLines } from './buffer-pref'
import { LogEngine } from './engine'
import { activateTab, addTab, closeTab, companionKey, homeTab, initialTabs, type TabsState, updateTab } from './tabs'

const RENDER_MS = 100
const PROGRESS_MS = 250
const SAMPLE_BYTES = 8192
// Several pods in one tab: lines wait this long to be put in time order with the other pods' lines...
const MERGE_HOLD_MS = 500
const MERGE_TICK_MS = 150
// ...and at the start, until every pod sent its first lines (its tail), at most this long.
const MERGE_WARMUP_MS = 3000

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** One pod of a tab that reads several replicas (one kubectl stream each). */
interface Member {
  streamId?: string
  status?: StreamStatus
  /** First lines arrived (or the stream ended): the tab stops waiting for its tail. */
  started?: boolean
}

/** What a stream feeds: a tab, and the pod when the tab reads several. */
interface Route {
  tabId: string
  pod?: string
}

export interface GroupMember {
  pod: string
  status?: StreamStatus
  lines: number
}

/** One engine and (at most) one stream per tab, or one stream per pod for a group of replicas. */
interface Slot {
  engine: LogEngine
  streamId?: string
  /** Replicas read together: pod name → its stream. */
  members?: Map<string, Member>
  membersSince?: number
  /** Bumped on every start/stop so a late startLogs answer for an old stream is ignored. */
  generation: number
  status?: StreamStatus
  /** Stream drops seen on this tab (reconnect marks). */
  marks: Mark[]
  /** While a file is being read: fraction of its bytes, 0 to 1. */
  loading?: number
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
  const byStream = useRef(new Map<string, Route>())
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
      s = { engine: new LogEngine(), generation: 0, marks: [] }
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

  const ingest = useCallback((s: Slot, route: Route, lines: string[]) => {
    if (route.pod === undefined) return s.engine.ingest(lines)
    s.engine.ingest(lines, route.pod)
    const m = s.members?.get(route.pod)
    if (m) m.started = true
  }, [])

  /** Status of one pod of a group; the tab shows the best of them (live if any pod is live). */
  const memberStatus = useCallback((s: Slot, route: Route, status: StreamStatus) => {
    const m = s.members?.get(route.pod!)
    if (!m) return
    m.status = status
    if (status.state === 'ended' || status.state === 'error') m.started = true
    s.marks = trackReconnect(s.marks, status, Date.now(), s.engine.lastTime, route.pod)
    s.status = groupStatus([...s.members!.values()])
  }, [])

  useEffect(() => {
    const offLines = window.logdeck.onLogLines(({ streamId, lines }) => {
      const route = byStream.current.get(streamId)
      if (route === undefined) {
        early.current.set(streamId, [...(early.current.get(streamId) ?? []), lines])
        return
      }
      ingest(slot(route.tabId), route, lines)
      if (route.pod === undefined && isVisible(route.tabId)) scheduleRender()
    })
    const offStatus = window.logdeck.onLogStatus(({ streamId, status }) => {
      const route = byStream.current.get(streamId)
      if (route === undefined) {
        earlyStatus.current.set(streamId, status)
        return
      }
      const s = slot(route.tabId)
      if (route.pod !== undefined) memberStatus(s, route, status)
      else {
        s.status = status
        s.marks = trackReconnect(s.marks, status, Date.now(), s.engine.lastTime)
      }
      if (isVisible(route.tabId)) setStatusTick((n) => n + 1)
    })
    // Groups of replicas: put the held lines in order and into the list.
    const merge = setInterval(() => {
      const now = Date.now()
      for (const [tabId, s] of slots) {
        if (!s.members) continue
        const warming = [...s.members.values()].some((m) => !m.started) && now - (s.membersSince ?? 0) < MERGE_WARMUP_MS
        if (!warming && s.engine.flush(now, MERGE_HOLD_MS) && isVisible(tabId)) scheduleRender()
      }
    }, MERGE_TICK_MS)
    return () => {
      offLines()
      offStatus()
      clearInterval(merge)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [scheduleRender, slot, slots, ingest, memberStatus])

  const stop = useCallback(async (tabId: string = stateRef.current.active) => {
    const s = slots.get(tabId)
    if (!s) return
    s.generation++
    const id = s.streamId
    s.streamId = undefined
    const members = s.members
    s.members = undefined
    if (id) {
      byStream.current.delete(id)
      await window.logdeck.stopLogs(id)
    }
    for (const m of members?.values() ?? []) {
      if (!m.streamId) continue
      byStream.current.delete(m.streamId)
      await window.logdeck.stopLogs(m.streamId)
    }
  }, [slots])

  const start = useCallback(
    async (request: StartLogsRequest, tabId: string = stateRef.current.active, opts: { defaultLevel?: Level } = {}) => {
      await stop(tabId)
      const s = slot(tabId)
      const generation = s.generation
      // The line limit from Preferences applies from the next pod opened (RNF2).
      const capacity = loadBufferLines()
      if (s.engine.capacity !== capacity) s.engine = new LogEngine({ capacity })
      s.engine.clear(opts.defaultLevel)
      s.marks = []
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
        byStream.current.set(id, { tabId })
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

  /** Starts one pod's stream in a group tab; its lines and status go to the tab, tagged with the pod. */
  const startMember = useCallback(
    async (tabId: string, s: Slot, request: StartLogsRequest) => {
      const generation = s.generation
      const member: Member = {}
      s.members?.set(request.pod, member)
      const route: Route = { tabId, pod: request.pod }
      try {
        const id = await window.logdeck.startLogs(request)
        if (s.generation !== generation || s.members?.get(request.pod) !== member || !slots.has(tabId)) {
          await window.logdeck.stopLogs(id)
          return
        }
        member.streamId = id
        byStream.current.set(id, route)
        for (const lines of early.current.get(id) ?? []) ingest(s, route, lines)
        const latest = earlyStatus.current.get(id)
        if (latest) memberStatus(s, route, latest)
        early.current.delete(id)
        earlyStatus.current.delete(id)
      } catch (err) {
        if (s.members?.get(request.pod) === member) memberStatus(s, route, { state: 'error', message: (err as Error).message })
      }
      setStatusTick((n) => n + 1)
    },
    [slots, ingest, memberStatus],
  )

  /** Reads several replicas in one tab: one stream per pod, lines merged by time (`base` without the pod). */
  const startGroup = useCallback(
    async (base: Omit<StartLogsRequest, 'pod'>, pods: readonly string[], tabId: string = stateRef.current.active) => {
      await stop(tabId)
      const s = slot(tabId)
      const capacity = loadBufferLines()
      if (s.engine.capacity !== capacity) s.engine = new LogEngine({ capacity })
      s.engine.clear()
      s.marks = []
      s.status = { state: 'connecting' }
      s.members = new Map()
      s.membersSince = Date.now()
      commit(updateTab(stateRef.current, tabId, { file: undefined }))
      setVersion((v) => v + 1)
      await Promise.all(pods.map((pod) => startMember(tabId, s, { ...base, pod })))
    },
    [stop, slot, commit, startMember],
  )

  /** Pods of the group changed (scaled, recreated): opens the new ones, stops the gone ones, marks both. */
  const syncGroup = useCallback(
    async (base: Omit<StartLogsRequest, 'pod'>, pods: readonly string[], tabId: string = stateRef.current.active) => {
      const s = slots.get(tabId)
      if (!s?.members) return
      const now = Date.now()
      const wanted = new Set(pods)
      for (const [pod, m] of [...s.members]) {
        if (wanted.has(pod)) continue
        s.members.delete(pod)
        s.marks = [...s.marks, { kind: 'pod', time: now, pod, change: 'left' }]
        if (m.streamId) {
          byStream.current.delete(m.streamId)
          void window.logdeck.stopLogs(m.streamId)
        }
      }
      const added = pods.filter((pod) => !s.members!.has(pod))
      for (const pod of added) s.marks = [...s.marks, { kind: 'pod', time: now, pod, change: 'joined' }]
      s.status = groupStatus([...s.members.values()])
      setStatusTick((n) => n + 1)
      await Promise.all(added.map((pod) => startMember(tabId, s, { ...base, pod })))
    },
    [slots, startMember],
  )

  /**
   * Loads a user-picked file into the tab; throws a LogFileError when it cannot be opened. `truncated` past
   * MAX_LOG_FILE_LINES: the lines read so far stay, with the share of the file they cover.
   */
  const openFile = useCallback(
    async (f: File, tabId: string = stateRef.current.active) => {
      await stop(tabId)
      // Size, emptiness and binary content are checked on the first bytes, before the tab changes.
      const problem = checkLogFile(f, f.size > 0 && f.size <= MAX_LOG_FILE_BYTES ? await f.slice(0, SAMPLE_BYTES).text() : '')
      if (problem) throw new LogFileError(problem, f.name)
      const s = slot(tabId)
      const generation = s.generation
      // A file keeps every line: it has a fixed size, so nothing needs dropping (1.6.3).
      if (s.engine.capacity !== Infinity) s.engine = new LogEngine({ capacity: Infinity })
      s.engine.clear()
      s.marks = []
      s.status = undefined
      s.loading = 0
      commit(updateTab(stateRef.current, tabId, { file: f.name, selection: {} }))
      // Each render filters, groups and charts every line loaded so far, so while reading only the first batch
      // is shown and the status bar counts up; the full view is built once, at the end.
      let first = true
      let tickAt = 0
      const result = await readLogLines(f.stream(), f.size, {
        onLines: async (lines) => {
          s.engine.ingest(lines)
          if (first) {
            first = false
            setVersion((v) => v + 1)
          }
          await yieldToUi()
        },
        onProgress: (fraction) => {
          s.loading = fraction
          if (Date.now() - tickAt >= PROGRESS_MS) {
            tickAt = Date.now()
            setStatusTick((n) => n + 1)
          }
        },
        cancelled: () => s.generation !== generation || !slots.has(tabId),
        full: () => s.engine.size >= MAX_LOG_FILE_LINES,
      })
      const fraction = s.loading ?? 1
      s.loading = undefined
      setVersion((v) => v + 1)
      if (result === 'binary') throw new LogFileError('binary', f.name)
      return result === 'full' ? { truncated: { lines: s.engine.size, fraction } } : {}
    },
    [stop, slot, commit, slots],
  )

  /** Returns the new tab id, or undefined at the limit. */
  const newTab = useCallback((): string | undefined => {
    const next = addTab(stateRef.current)
    if (!next) return undefined
    commit(next)
    setVersion((v) => v + 1)
    return next.active
  }, [commit])

  /** The Home button: shows the home screen and leaves the pod tabs running. False at the tab limit. */
  const openHome = useCallback((): boolean => {
    const next = homeTab(stateRef.current)
    if (!next) return false
    if (next !== stateRef.current) {
      commit(next)
      setVersion((v) => v + 1)
    }
    return true
  }, [commit])

  /** Back to the welcome screen in this tab: stops its streams and forgets the pod/file. */
  const goHome = useCallback(
    async (tabId: string = stateRef.current.active) => {
      await stop(tabId)
      await stop(companionKey(tabId))
      slots.get(tabId)?.engine.clear()
      const s = slots.get(tabId)
      if (s) {
        s.status = undefined
        s.marks = []
      }
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
  const counts = activeSlot.engine.podCounts
  const members: GroupMember[] | undefined =
    activeSlot.members && [...activeSlot.members].map(([pod, m]) => ({ pod, lines: counts.get(pod) ?? 0, ...(m.status && { status: m.status }) }))
  const companionSlot = activeTab.compare ? slot(companionKey(activeTab.id)) : undefined
  return {
    tabs: state.tabs,
    activeTab,
    engine: activeSlot.engine,
    // version changes on every ingest for the active tab and on tab switches (engine identity changes too);
    // not while a file is being read (see openFile), or every re-render would redo the view over all lines
    version: activeSlot.loading !== undefined ? version : version + activeSlot.engine.version + (companionSlot?.engine.version ?? 0),
    companion: companionSlot && { engine: companionSlot.engine, status: companionSlot.status },
    startCompare,
    stopCompare,
    status: activeSlot.status,
    members,
    marks: activeSlot.marks,
    loading: activeSlot.loading,
    file: activeTab.file,
    start,
    startGroup,
    syncGroup,
    stop,
    openFile,
    newTab,
    openHome,
    goHome,
    close,
    activate,
    setSelection,
    setOptions,
  }
}

export type LogTabs = ReturnType<typeof useLogTabs>

/** A group tab is live while any pod is; it reconnects when none is live and one is reconnecting. */
export function groupStatus(members: readonly { status?: StreamStatus }[]): StreamStatus {
  const states = members.map((m) => m.status?.state ?? 'connecting')
  if (states.includes('live')) return { state: 'live' }
  const reconnecting = members.find((m) => m.status?.state === 'reconnecting')
  if (reconnecting?.status) return reconnecting.status
  if (states.includes('connecting')) return { state: 'connecting' }
  if (states.length > 0 && states.every((x) => x === 'error')) return members[0]!.status!
  return { state: 'ended' }
}
