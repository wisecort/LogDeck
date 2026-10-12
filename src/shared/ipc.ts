// IPC contract between main, preload and renderer. Types only plus channel names;
// no Node imports so the renderer can use it.

export const IPC = {
  version: 'k8s:version',
  contexts: 'k8s:contexts',
  namespaces: 'k8s:namespaces',
  pods: 'k8s:pods',
  startLogs: 'logs:start',
  stopLogs: 'logs:stop',
  logLines: 'logs:lines',
  logStatus: 'logs:status',
} as const

export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: string }

export interface VersionInfo {
  installed: boolean
  version?: string
  message?: string
}

export interface ContextInfo {
  name: string
  cluster: string
  namespace?: string
  current: boolean
  /** Name contains `prod`/`prd` (G5). */
  production: boolean
}

export interface NamespaceList {
  namespaces: string[]
  /** False when RBAC forbids listing namespaces (common on OKD). */
  canList: boolean
  defaultNamespace?: string
}

export interface PodInfo {
  name: string
  namespace: string
  phase: string
  status: string
  ready: string
  restarts: number
  createdAt?: number
  containers: string[]
  initContainers: string[]
  canPrevious: boolean
}

export interface StreamStatus {
  state: 'connecting' | 'live' | 'reconnecting' | 'ended' | 'error'
  attempt?: number
  retryInMs?: number
  message?: string
}

export interface StartLogsRequest {
  context: string
  namespace: string
  pod: string
  container: string
  tail?: number
  since?: string
  previous?: boolean
}

export interface LogLinesEvent {
  streamId: string
  lines: string[]
}

export interface LogStatusEvent {
  streamId: string
  status: StreamStatus
}
