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
  getPresets: 'presets:get',
  setPresets: 'presets:set',
  openShell: 'shell:open',
  shellInput: 'shell:input',
  shellResize: 'shell:resize',
  closeShell: 'shell:close',
  shellData: 'shell:data',
  shellExit: 'shell:exit',
  aiStatus: 'ai:status',
  aiSetSettings: 'ai:settings:set',
  aiSetKey: 'ai:key:set',
  aiDeleteKey: 'ai:key:delete',
  aiTest: 'ai:test',
  aiPreview: 'ai:preview',
  aiExplain: 'ai:explain',
  aiFollowUp: 'ai:follow-up',
  saveText: 'file:save-text',
  copyText: 'clipboard:copy-text',
  setLanguage: 'app:set-language',
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

export interface OpenShellRequest {
  context: string
  namespace: string
  pod: string
  container: string
  cols: number
  rows: number
}

export interface ShellDataEvent {
  shellId: string
  data: string
}

export interface ShellExitEvent {
  shellId: string
  code: number
}
