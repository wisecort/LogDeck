// IPC contract between main, preload and renderer. Types only plus channel names;
// no Node imports so the renderer can use it.

export const IPC = {
  version: 'k8s:version',
  contexts: 'k8s:contexts',
  namespaces: 'k8s:namespaces',
  pods: 'k8s:pods',
  builds: 'k8s:builds',
  events: 'k8s:events',
  exposure: 'k8s:exposure',
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
  openLink: 'app:open-link',
  checkUpdate: 'app:check-update',
  kubeconfigGet: 'kubeconfig:get',
  kubeconfigAdd: 'kubeconfig:add',
  kubeconfigRemove: 'kubeconfig:remove',
  kubeconfigUseDefault: 'kubeconfig:use-default',
} as const

/** A kubeconfig file or a folder of them, picked by the user in a system dialog (F1.6). */
export interface KubeconfigSource {
  kind: 'file' | 'folder'
  path: string
}

export interface KubeconfigSettings {
  /** The default kubeconfig (KUBECONFIG or kubectl's default path) stays in the list. */
  useDefault: boolean
  sources: KubeconfigSource[]
}

/** What the contexts dialog shows: paths only, never file contents (G3). */
export interface KubeconfigView {
  useDefault: boolean
  defaults: string[]
  sources: Array<KubeconfigSource & { files: number; missing: boolean }>
}

export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: string }

export interface VersionInfo {
  installed: boolean
  version?: string
  message?: string
  /** kubectl is not installed at all; the welcome screen then shows how to install it. */
  missing?: boolean
  /** Install command for this OS (winget, brew, snap), set only when `missing`. */
  installHint?: string
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
  /** app, or OKD build/deployer pod (hidden by default in the sidebar). */
  kind: 'app' | 'build' | 'deploy'
  node?: string
  qosClass?: string
  /** Runtime details per container (Pod tab, uptime, restart marks); init containers first. */
  details?: ContainerDetail[]
  /** Matched against service selectors (Pod tab → Access). */
  labels?: Record<string, string>
  /** StatefulSet, Deployment, DeploymentConfig, DaemonSet...: replicas share it and can be read together. */
  owner?: { kind: string; name: string }
}

export interface ServiceInfo {
  name: string
  type: string
  /** Empty for services without a selector (ExternalName, manual endpoints): they match no pod. */
  selector: Record<string, string>
  ports: Array<{ name?: string; port: number; targetPort?: string }>
}

/** An OKD Route or an Ingress rule pointing at a service. */
export interface AccessRoute {
  kind: 'route' | 'ingress'
  name: string
  service: string
  url: string
}

export interface Exposure {
  services: ServiceInfo[]
  routes: AccessRoute[]
}

/** How a probe checks the container; exec commands are left out (they may carry secrets). */
export interface ProbeSummary {
  kind: 'http' | 'tcp' | 'command' | 'grpc'
  /** `GET :8080/health` or `:5432`. */
  target?: string
  periodSeconds?: number
}

export interface ContainerDetail {
  name: string
  init: boolean
  image?: string
  state: 'running' | 'waiting' | 'terminated' | 'unknown'
  /** Waiting/terminated reason (CrashLoopBackOff, OOMKilled, Completed...). */
  reason?: string
  /** Start of the current run (epoch ms): the container's uptime. */
  startedAt?: number
  restarts: number
  /** The previous run, the only one Kubernetes keeps. */
  last?: TerminatedRun
  requests?: Resources
  limits?: Resources
  probes?: { readiness?: ProbeSummary; liveness?: ProbeSummary; startup?: ProbeSummary }
}

export interface TerminatedRun {
  reason?: string
  exitCode?: number
  startedAt?: number
  finishedAt?: number
}

export interface Resources {
  cpu?: string
  memory?: string
}

/** OKD/OpenShift Build object (history); its log lives in podName, which may be gone. */
export interface BuildInfo {
  name: string
  phase: string
  reason?: string
  strategy?: string
  commit?: string
  startedAt?: number
  durationMs?: number
  podName: string
}

/** A Kubernetes event about a pod (probe failure, OOM kill, back-off...). */
export interface PodEvent {
  id: string
  type: 'Normal' | 'Warning'
  reason: string
  message: string
  count: number
  firstTime?: number
  lastTime: number
  /** From involvedObject.fieldPath `spec.containers{name}`. */
  container?: string
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
  /** Finished container: read once without following. */
  once?: boolean
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
