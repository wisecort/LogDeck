import { UnsafeArgsError, validateContainerName } from './args'
import type { PodEvent } from '../shared/ipc'

interface EventJson {
  metadata?: { uid?: string; name?: string; creationTimestamp?: string }
  involvedObject?: { kind?: string; name?: string; fieldPath?: string }
  type?: string
  reason?: string
  message?: string
  count?: number
  firstTimestamp?: string
  lastTimestamp?: string
  eventTime?: string
  series?: { count?: number; lastObservedTime?: string }
}

const MAX_MESSAGE = 500
const CONTAINER = /^spec\.(?:init)?[cC]ontainers\{([^}]+)\}$/

function time(v: unknown): number | undefined {
  if (typeof v !== 'string') return undefined
  const ms = Date.parse(v)
  return Number.isNaN(ms) ? undefined : ms
}

const str = (v: unknown, max = 120) => (typeof v === 'string' ? v.slice(0, max) : '')

/** Events about one pod from `kubectl get events -o json`, oldest first. Cluster text is data (G7). */
export function parseEvents(json: string, pod: string): PodEvent[] {
  const parsed = JSON.parse(json) as { items?: EventJson[] }
  const out: PodEvent[] = []
  for (const e of Array.isArray(parsed.items) ? parsed.items : []) {
    if (e.involvedObject?.kind !== 'Pod' || e.involvedObject.name !== pod) continue
    const last = time(e.series?.lastObservedTime) ?? time(e.lastTimestamp) ?? time(e.eventTime) ?? time(e.firstTimestamp) ?? time(e.metadata?.creationTimestamp)
    if (last === undefined) continue
    const event: PodEvent = {
      id: str(e.metadata?.uid) || str(e.metadata?.name, 253) || `${last}`,
      type: e.type === 'Warning' ? 'Warning' : 'Normal',
      reason: str(e.reason) || '—',
      message: str(e.message, MAX_MESSAGE),
      count: typeof e.series?.count === 'number' ? e.series.count : typeof e.count === 'number' ? e.count : 1,
      lastTime: last,
    }
    const first = time(e.firstTimestamp) ?? time(e.eventTime)
    if (first !== undefined) event.firstTime = first
    const container = CONTAINER.exec(e.involvedObject.fieldPath ?? '')?.[1]
    if (container) {
      try {
        event.container = validateContainerName(container)
      } catch (err) {
        if (!(err instanceof UnsafeArgsError)) throw err
      }
    }
    out.push(event)
  }
  return out.sort((a, b) => a.lastTime - b.lastTime)
}
