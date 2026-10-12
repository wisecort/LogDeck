import type {
  ContextInfo,
  LogLinesEvent,
  LogStatusEvent,
  NamespaceList,
  OpenShellRequest,
  PodInfo,
  ShellDataEvent,
  ShellExitEvent,
  StartLogsRequest,
  VersionInfo,
} from '../shared/ipc'
import type { NamespacePresets } from '../shared/presets'

export interface LogDeckApi {
  readonly appName: string
  kubectlVersion(): Promise<VersionInfo>
  listContexts(): Promise<ContextInfo[]>
  listNamespaces(context: string): Promise<NamespaceList>
  listPods(context: string, namespace: string): Promise<PodInfo[]>
  /** Returns the stream id used by the log events. */
  startLogs(request: StartLogsRequest): Promise<string>
  stopLogs(streamId: string): Promise<void>
  /** Returns an unsubscribe function. */
  onLogLines(listener: (event: LogLinesEvent) => void): () => void
  onLogStatus(listener: (event: LogStatusEvent) => void): () => void
  getPresets(key: string): Promise<NamespacePresets>
  setPresets(key: string, value: NamespacePresets): Promise<NamespacePresets>
  /** Pod Shell (P5); asks for confirmation in production contexts. Returns the shell id. */
  openShell(request: OpenShellRequest): Promise<string>
  shellInput(shellId: string, data: string): Promise<void>
  shellResize(shellId: string, cols: number, rows: number): Promise<void>
  closeShell(shellId: string): Promise<void>
  onShellData(listener: (event: ShellDataEvent) => void): () => void
  onShellExit(listener: (event: ShellExitEvent) => void): () => void
}

declare global {
  interface Window {
    readonly logdeck: LogDeckApi
  }
}
