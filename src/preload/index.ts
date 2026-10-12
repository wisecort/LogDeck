import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type IpcResult, type LogLinesEvent, type LogStatusEvent } from '../shared/ipc'
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
  startLogs: (request) => invoke(IPC.startLogs, request),
  stopLogs: (streamId) => invoke(IPC.stopLogs, streamId),
  onLogLines: (listener) => subscribe<LogLinesEvent>(IPC.logLines, listener),
  onLogStatus: (listener) => subscribe<LogStatusEvent>(IPC.logStatus, listener),
}

contextBridge.exposeInMainWorld('logdeck', api)
