import type {
  BuildInfo,
  ContextInfo,
  Exposure,
  LogLinesEvent,
  LogStatusEvent,
  NamespaceList,
  OpenShellRequest,
  PodEvent,
  PodInfo,
  ShellDataEvent,
  ShellExitEvent,
  StartLogsRequest,
  VersionInfo,
} from '../shared/ipc'
import type { ExplainGroupInput, ExplainResult, KeyServiceName, PreviewResult } from '../shared/ai'
import type { AiSettings, AiStatus } from '../shared/ai-settings'
import type { NamespacePresets } from '../shared/presets'
import type { UpdateInfo } from '../shared/update'

export interface LogDeckApi {
  readonly appName: string
  kubectlVersion(): Promise<VersionInfo>
  listContexts(): Promise<ContextInfo[]>
  listNamespaces(context: string): Promise<NamespaceList>
  listPods(context: string, namespace: string): Promise<PodInfo[]>
  /** OKD/OpenShift builds; [] when the cluster has no Build API or no permission. */
  listBuilds(context: string, namespace: string): Promise<BuildInfo[]>
  /** Kubernetes events about one pod; [] without permission. */
  listPodEvents(context: string, namespace: string, pod: string): Promise<PodEvent[]>
  /** Services, OKD Routes and Ingresses of a namespace (how pods are reached); empty lists without permission. */
  listExposure(context: string, namespace: string): Promise<Exposure>
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
  aiStatus(): Promise<AiStatus>
  setAiSettings(partial: Partial<AiSettings>): Promise<AiStatus>
  /** The key goes to the Keychain; it is never returned. */
  setAiKey(service: KeyServiceName, key: string): Promise<AiStatus>
  deleteAiKey(service: KeyServiceName): Promise<AiStatus>
  testAi(): Promise<string>
  /** F7.2: masked preview; nothing is sent. */
  previewExplain(groups: ExplainGroupInput[], opts: { maskInternalIps: boolean; question?: string }): Promise<PreviewResult>
  /** Sends exactly the previewed text, once. */
  explain(previewId: string): Promise<ExplainResult>
  /** Follow-up question on logs already approved in the preview. */
  followUp(conversationId: string, question: string): Promise<ExplainResult>
  /** Save dialog for exported logs and AI suggestions; returns the path or null. */
  saveText(content: string, suggestedName: string): Promise<string | null>
  /** Writes plain text to the system clipboard (works without window focus). */
  copyText(text: string): Promise<void>
  /** Interface language, so main can translate the native menu. */
  setLanguage(lang: 'pt-BR' | 'pt-PT' | 'en' | 'es'): Promise<void>
  /** Opens one of the fixed links (GitHub, LinkedIn, latest release) in the default browser. */
  openLink(id: 'github' | 'linkedin' | 'releases'): Promise<void>
  /** Latest published version (anonymous GET to GitHub, at most once a day); null on any failure. */
  checkUpdate(): Promise<UpdateInfo | null>
}

declare global {
  interface Window {
    readonly logdeck: LogDeckApi
  }
}
