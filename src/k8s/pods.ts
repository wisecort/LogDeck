import { UnsafeArgsError, validateContainerName, validatePodName } from './args'
import type { ContainerDetail, ProbeSummary, Resources, TerminatedRun } from '../shared/ipc'

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
  /** OKD/OpenShift build and deployer pods are hidden by default in the sidebar. */
  kind: PodKind
  node?: string
  qosClass?: string
  details?: ContainerDetail[]
}

export type PodKind = 'app' | 'build' | 'deploy'

const BUILD_KEY = 'openshift.io/build.name'
const DEPLOYER_KEY = 'openshift.io/deployer-pod-for.name'

/** Build pods (BuildConfig) and deployer pods (DeploymentConfig) by their OpenShift labels/annotations. */
export function podKind(metadata: { labels?: Record<string, string>; annotations?: Record<string, string> } | undefined): PodKind {
  const has = (key: string) => Boolean(metadata?.labels?.[key] ?? metadata?.annotations?.[key])
  if (has(BUILD_KEY)) return 'build'
  if (has(DEPLOYER_KEY)) return 'deploy'
  return 'app'
}

interface TerminatedJson {
  reason?: string
  exitCode?: number
  startedAt?: string
  finishedAt?: string
}

interface ContainerState {
  waiting?: { reason?: string }
  terminated?: TerminatedJson
  running?: { startedAt?: string }
}

interface ContainerStatus {
  name?: string
  ready?: boolean
  restartCount?: number
  image?: string
  state?: ContainerState
  lastState?: ContainerState
}

interface ProbeJson {
  httpGet?: { path?: string; port?: number | string; scheme?: string }
  tcpSocket?: { port?: number | string }
  grpc?: { port?: number }
  exec?: unknown
  periodSeconds?: number
}

interface ContainerSpec {
  name?: string
  image?: string
  resources?: { requests?: Record<string, unknown>; limits?: Record<string, unknown> }
  readinessProbe?: ProbeJson
  livenessProbe?: ProbeJson
  startupProbe?: ProbeJson
}

interface PodJson {
  metadata?: {
    name?: string
    namespace?: string
    creationTimestamp?: string
    deletionTimestamp?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  spec?: { nodeName?: string; containers?: ContainerSpec[]; initContainers?: ContainerSpec[] }
  status?: { phase?: string; qosClass?: string; containerStatuses?: ContainerStatus[]; initContainerStatuses?: ContainerStatus[] }
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

const MAX_TEXT = 300

/** Cluster text is data: plain strings only, capped. */
function text(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v.slice(0, MAX_TEXT) : undefined
}

function time(v: unknown): number | undefined {
  if (typeof v !== 'string') return undefined
  const ms = Date.parse(v)
  return Number.isNaN(ms) ? undefined : ms
}

function resources(r: Record<string, unknown> | undefined): Resources | undefined {
  const out: Resources = {}
  const cpu = text(r?.cpu)
  const memory = text(r?.memory)
  if (cpu) out.cpu = cpu
  if (memory) out.memory = memory
  return cpu || memory ? out : undefined
}

function probe(p: ProbeJson | undefined): ProbeSummary | undefined {
  if (!p || typeof p !== 'object') return undefined
  const period = typeof p.periodSeconds === 'number' ? { periodSeconds: p.periodSeconds } : {}
  if (p.httpGet) {
    const port = p.httpGet.port ?? ''
    return { kind: 'http', target: `GET :${port}${text(p.httpGet.path) ?? '/'}`.slice(0, MAX_TEXT), ...period }
  }
  if (p.tcpSocket) return { kind: 'tcp', target: `:${p.tcpSocket.port ?? ''}`.slice(0, MAX_TEXT), ...period }
  if (p.grpc) return { kind: 'grpc', target: `:${p.grpc.port ?? ''}`, ...period }
  // The command may carry credentials: only the kind is kept.
  if (p.exec) return { kind: 'command', ...period }
  return undefined
}

function terminated(t: TerminatedJson | undefined): TerminatedRun | undefined {
  if (!t) return undefined
  const run: TerminatedRun = {}
  const reason = text(t.reason)
  if (reason) run.reason = reason
  if (typeof t.exitCode === 'number') run.exitCode = t.exitCode
  const started = time(t.startedAt)
  const finished = time(t.finishedAt)
  if (started !== undefined) run.startedAt = started
  if (finished !== undefined) run.finishedAt = finished
  return run
}

function containerDetails(specs: ContainerSpec[] | undefined, statuses: ContainerStatus[] | undefined, init: boolean): ContainerDetail[] {
  const out: ContainerDetail[] = []
  for (const spec of specs ?? []) {
    let name: string
    try {
      name = validateContainerName(spec.name ?? '')
    } catch (err) {
      if (!(err instanceof UnsafeArgsError)) throw err
      continue
    }
    const st = statuses?.find((c) => c.name === name)
    const d: ContainerDetail = { name, init, state: 'unknown', restarts: st?.restartCount ?? 0 }
    const image = text(st?.image) ?? text(spec.image)
    if (image) d.image = image
    if (st?.state?.running) {
      d.state = 'running'
      const started = time(st.state.running.startedAt)
      if (started !== undefined) d.startedAt = started
    } else if (st?.state?.waiting) {
      d.state = 'waiting'
      const reason = text(st.state.waiting.reason)
      if (reason) d.reason = reason
    } else if (st?.state?.terminated) {
      d.state = 'terminated'
      const run = terminated(st.state.terminated)!
      if (run.reason) d.reason = run.reason
      if (run.startedAt !== undefined) d.startedAt = run.startedAt
    }
    const last = terminated(st?.lastState?.terminated)
    if (last) d.last = last
    const requests = resources(spec.resources?.requests)
    const limits = resources(spec.resources?.limits)
    if (requests) d.requests = requests
    if (limits) d.limits = limits
    const probes: NonNullable<ContainerDetail['probes']> = {}
    const readiness = probe(spec.readinessProbe)
    const liveness = probe(spec.livenessProbe)
    const startup = probe(spec.startupProbe)
    if (readiness) probes.readiness = readiness
    if (liveness) probes.liveness = liveness
    if (startup) probes.startup = startup
    if (readiness || liveness || startup) d.probes = probes
    out.push(d)
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
      kind: podKind(pod.metadata),
    }
    const node = text(pod.spec?.nodeName)
    const qos = text(pod.status?.qosClass)
    if (node) summary.node = node
    if (qos) summary.qosClass = qos
    summary.details = [
      ...containerDetails(pod.spec?.initContainers, pod.status?.initContainerStatuses, true),
      ...containerDetails(pod.spec?.containers, statuses, false),
    ]
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
