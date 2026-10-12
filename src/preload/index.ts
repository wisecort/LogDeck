import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type IpcResult, type LogLinesEvent, type LogStatusEvent, type ShellDataEvent, type ShellExitEvent } from '../shared/ipc'
import type { LogDeckApi } from './api'

// Narrow, typed surface exposed to the renderer (SPEC §2). The renderer never builds kubectl argv.

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>
  if (!result.ok) throw new Error(result.error)
  return result.value
}

function subscribe<T>(channel: string, listener: (event: T) => void): () => void {
  const wrapped = (_e: IpcRendererEvent, payload: T) => listener(payload)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

const api: LogDeckApi = {
  appName: 'LogDeck',
  kubectlVersion: () => invoke(IPC.version),
  listContexts: () => invoke(IPC.contexts),
  listNamespaces: (context) => invoke(IPC.namespaces, context),
  listPods: (context, namespace) => invoke(IPC.pods, context, namespace),
  listBuilds: (context, namespace) => invoke(IPC.builds, context, namespace),
  startLogs: (request) => invoke(IPC.startLogs, request),
  stopLogs: (streamId) => invoke(IPC.stopLogs, streamId),
  onLogLines: (listener) => subscribe<LogLinesEvent>(IPC.logLines, listener),
  onLogStatus: (listener) => subscribe<LogStatusEvent>(IPC.logStatus, listener),
  getPresets: (key) => invoke(IPC.getPresets, key),
  setPresets: (key, value) => invoke(IPC.setPresets, key, value),
  openShell: (request) => invoke(IPC.openShell, request),
  shellInput: (shellId, data) => invoke(IPC.shellInput, shellId, data),
  shellResize: (shellId, cols, rows) => invoke(IPC.shellResize, shellId, cols, rows),
  closeShell: (shellId) => invoke(IPC.closeShell, shellId),
  onShellData: (listener) => subscribe<ShellDataEvent>(IPC.shellData, listener),
  onShellExit: (listener) => subscribe<ShellExitEvent>(IPC.shellExit, listener),
  aiStatus: () => invoke(IPC.aiStatus),
  setAiSettings: (partial) => invoke(IPC.aiSetSettings, partial),
  setAiKey: (service, key) => invoke(IPC.aiSetKey, service, key),
  deleteAiKey: (service) => invoke(IPC.aiDeleteKey, service),
  testAi: () => invoke(IPC.aiTest),
  previewExplain: (groups, opts) => invoke(IPC.aiPreview, groups, opts),
  explain: (previewId) => invoke(IPC.aiExplain, previewId),
  followUp: (conversationId, question) => invoke(IPC.aiFollowUp, conversationId, question),
  saveText: (content, suggestedName) => invoke(IPC.saveText, content, suggestedName),
  copyText: (text) => invoke(IPC.copyText, text),
  setLanguage: (lang) => invoke(IPC.setLanguage, lang),
  openLink: (id) => invoke(IPC.openLink, id),
}

contextBridge.exposeInMainWorld('logdeck', api)
