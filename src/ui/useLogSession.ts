import { useCallback, useEffect, useRef, useState } from 'react'
import type { StartLogsRequest, StreamStatus } from '../shared/ipc'
import { LogEngine } from './engine'

const RENDER_MS = 100

/** One live log session: engine + stream subscription, re-rendering at most every 100 ms (RNF5). */
export function useLogSession() {
  // One engine per mounted session; a state slot keeps the same instance across renders.
  const [engine] = useState(() => new LogEngine())
  const streamRef = useRef<string | undefined>(undefined)
  // Events that arrive before startLogs resolves with the id.
  const early = useRef(new Map<string, string[][]>())
  const earlyStatus = useRef(new Map<string, StreamStatus>())
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [version, setVersion] = useState(0)
  const [status, setStatus] = useState<StreamStatus | undefined>(undefined)

  const scheduleRender = useCallback(() => {
    timer.current ??= setTimeout(() => {
      timer.current = undefined
      setVersion(engine.version)
    }, RENDER_MS)
  }, [engine])

  useEffect(() => {
    const offLines = window.logdeck.onLogLines(({ streamId, lines }) => {
      if (streamId === streamRef.current) {
        engine.ingest(lines)
        scheduleRender()
      } else if (streamRef.current === undefined) {
        early.current.set(streamId, [...(early.current.get(streamId) ?? []), lines])
      }
    })
    const offStatus = window.logdeck.onLogStatus(({ streamId, status }) => {
      if (streamId === streamRef.current) setStatus(status)
      else if (streamRef.current === undefined) earlyStatus.current.set(streamId, status)
    })
    return () => {
      offLines()
      offStatus()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [scheduleRender, engine])

  const stop = useCallback(async () => {
    const id = streamRef.current
    streamRef.current = undefined
    if (id) await window.logdeck.stopLogs(id)
  }, [])

  const start = useCallback(
    async (request: StartLogsRequest) => {
      await stop()
      early.current.clear()
      earlyStatus.current.clear()
      engine.clear()
      setVersion(engine.version)
      setStatus({ state: 'connecting' })
      try {
        const id = await window.logdeck.startLogs(request)
        streamRef.current = id
        for (const lines of early.current.get(id) ?? []) engine.ingest(lines)
        const latest = earlyStatus.current.get(id)
        if (latest) setStatus(latest)
        early.current.clear()
        earlyStatus.current.clear()
        scheduleRender()
      } catch (err) {
        setStatus({ state: 'error', message: (err as Error).message })
      }
    },
    [stop, scheduleRender, engine],
  )

  return { engine, version, status, start, stop }
}
