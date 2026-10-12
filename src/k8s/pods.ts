import { UnsafeArgsError, validateContainerName, validatePodName } from './args'

export interface PodSummary {
  name: string
  namespace: string
  phase: string
  /** Effective status as `kubectl get pods` shows it (Running, CrashLoopBackOff, Init:Error...). */
  status: string
  ready: string
  restarts: number
  createdAt?: number
  containers: string[]
  initContainers: string[]
  /** `--previous` makes sense (restarts > 0 or CrashLoopBackOff). */
  canPrevious: boolean
}

interface ContainerState {
  waiting?: { reason?: string }
  terminated?: { reason?: string }
  running?: unknown
}

interface ContainerStatus {
  name?: string
  ready?: boolean
  restartCount?: number
  state?: ContainerState
}

interface PodJson {
  metadata?: { name?: string; namespace?: string; creationTimestamp?: string; deletionTimestamp?: string }
  spec?: { containers?: Array<{ name?: string }>; initContainers?: Array<{ name?: string }> }
  status?: { phase?: string; containerStatuses?: ContainerStatus[]; initContainerStatuses?: ContainerStatus[] }
}

function items<T>(json: string): T[] {
  const parsed = JSON.parse(json) as { items?: T[] }
  return Array.isArray(parsed.items) ? parsed.items : []
}

export function parseNamespaces(json: string): string[] {
  return items<{ metadata?: { name?: string } }>(json)
    .map((n) => n.metadata?.name)
    .filter((n): n is string => typeof n === 'string')
    .sort()
}

function validNames(list: Array<{ name?: string }> | undefined): string[] {
  const out: string[] = []
  for (const c of list ?? []) {
    try {
      out.push(validateContainerName(c.name ?? ''))
    } catch (err) {
      if (!(err instanceof UnsafeArgsError)) throw err
    }
  }
  return out
}

/** Mirrors the STATUS column of `kubectl get pods`. */
function effectiveStatus(pod: PodJson): string {
  if (pod.metadata?.deletionTimestamp) return 'Terminating'
  const phase = pod.status?.phase ?? 'Unknown'
  for (const c of pod.status?.initContainerStatuses ?? []) {
    const reason = c.state?.waiting?.reason ?? (c.state?.terminated?.reason !== 'Completed' ? c.state?.terminated?.reason : undefined)
    if (reason) return `Init:${reason}`
  }
  for (const c of pod.status?.containerStatuses ?? []) {
    if (c.state?.waiting?.reason) return c.state.waiting.reason
  }
  if (phase !== 'Running') {
    for (const c of pod.status?.containerStatuses ?? []) {
      if (c.state?.terminated?.reason) return c.state.terminated.reason
    }
  }
  return phase
}

export function parsePods(json: string, onInvalid?: (name: string) => void): PodSummary[] {
  const out: PodSummary[] = []
  for (const pod of items<PodJson>(json)) {
    const name = pod.metadata?.name ?? ''
    try {
      validatePodName(name)
    } catch (err) {
      if (!(err instanceof UnsafeArgsError)) throw err
      onInvalid?.(name)
      continue
    }
    const statuses = pod.status?.containerStatuses ?? []
    const all = [...statuses, ...(pod.status?.initContainerStatuses ?? [])]
    const restarts = all.reduce((n, c) => n + (c.restartCount ?? 0), 0)
    const status = effectiveStatus(pod)
    const containers = validNames(pod.spec?.containers)
    const summary: PodSummary = {
      name,
      namespace: pod.metadata?.namespace ?? '',
      phase: pod.status?.phase ?? 'Unknown',
      status,
      ready: `${statuses.filter((c) => c.ready).length}/${containers.length}`,
      restarts,
      containers,
      initContainers: validNames(pod.spec?.initContainers),
      canPrevious: restarts > 0 || status.endsWith('CrashLoopBackOff'),
    }
    const created = pod.metadata?.creationTimestamp ? Date.parse(pod.metadata.creationTimestamp) : NaN
    if (!Number.isNaN(created)) summary.createdAt = created
    out.push(summary)
  }
  return out
}

export function formatAge(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86_400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86_400)}d`
}
