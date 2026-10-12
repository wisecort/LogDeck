import type {
  ContextInfo,
  LogLinesEvent,
  LogStatusEvent,
  NamespaceList,
  PodInfo,
  StartLogsRequest,
  VersionInfo,
} from '../shared/ipc'

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
}

declare global {
  interface Window {
    readonly logdeck: LogDeckApi
  }
}
