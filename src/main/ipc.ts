import { dialog, ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron'
import { isProductionContext } from '../k8s/contexts'
import type { K8sService } from '../k8s/service'
import { PodShell, type ShellRegistry } from '../k8s/shell'
import { LogStream, type StreamRegistry } from '../k8s/stream'
import {
  IPC,
  type IpcResult,
  type LogLinesEvent,
  type LogStatusEvent,
  type OpenShellRequest,
  type ShellDataEvent,
  type ShellExitEvent,
  type StartLogsRequest,
} from '../shared/ipc'
import type { NamespacePresets } from '../shared/presets'
import type { PresetStore } from './presets-store'

export interface IpcDeps {
  service: K8sService
  registry: StreamRegistry
  shells: ShellRegistry
  presets: PresetStore
  /** Only this renderer may call the API. */
  trusted: () => WebContents | undefined
}

const DEFAULT_TAIL = 1000

function str(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`${name} inválido`)
  return value
}

function optional<T>(value: unknown, check: (v: unknown) => v is T, name: string): T | undefined {
  if (value === undefined) return undefined
  if (!check(value)) throw new Error(`${name} inválido`)
  return value
}

const isNumber = (v: unknown): v is number => typeof v === 'number'
const isString = (v: unknown): v is string => typeof v === 'string'
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean'

/** Wraps a handler: checks the sender and turns errors into a serialisable result. */
function handle<A extends unknown[], T>(deps: IpcDeps, channel: string, fn: (event: IpcMainInvokeEvent, ...args: A) => Promise<T>): void {
  ipcMain.handle(channel, async (event, ...args): Promise<IpcResult<T>> => {
    if (event.sender !== deps.trusted()) return { ok: false, error: 'remetente não autorizado' }
    try {
      return { ok: true, value: await fn(event, ...(args as A)) }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })
}

export function registerIpc(deps: IpcDeps): void {
  const { service, registry } = deps

  handle(deps, IPC.version, () => service.version())
  handle(deps, IPC.contexts, () => service.contexts())
  handle(deps, IPC.namespaces, (_e, context: unknown) => service.namespaces(str(context, 'contexto')))
  handle(deps, IPC.pods, (_e, context: unknown, namespace: unknown) =>
    service.pods(str(context, 'contexto'), str(namespace, 'namespace')),
  )

  handle(deps, IPC.startLogs, async (event, raw: unknown) => {
    const req = (raw ?? {}) as Partial<Record<keyof StartLogsRequest, unknown>>
    if (service.knownContexts.length === 0) await service.contexts()
    const tail = optional(req.tail, isNumber, 'tail') ?? DEFAULT_TAIL
    const since = optional(req.since, isString, 'since')
    const previous = optional(req.previous, isBoolean, 'previous')
    const sender = event.sender
    let streamId = ''
    const stream = new LogStream({
      target: {
        context: str(req.context, 'contexto'),
        knownContexts: service.knownContexts,
        namespace: str(req.namespace, 'namespace'),
        pod: str(req.pod, 'pod'),
        container: str(req.container, 'container'),
      },
      tail,
      ...(since !== undefined && { since }),
      ...(previous !== undefined && { previous }),
      onLines: (lines) => {
        if (!sender.isDestroyed()) sender.send(IPC.logLines, { streamId, lines } satisfies LogLinesEvent)
      },
      onStatus: (status) => {
        if (!sender.isDestroyed()) sender.send(IPC.logStatus, { streamId, status } satisfies LogStatusEvent)
      },
    })
    streamId = registry.add(stream)
    try {
      stream.start()
    } catch (err) {
      await registry.stop(streamId)
      throw err
    }
    return streamId
  })

  handle(deps, IPC.stopLogs, async (_e, streamId: unknown) => {
    await registry.stop(str(streamId, 'streamId'))
  })

  handle(deps, IPC.getPresets, async (_e, key: unknown) => deps.presets.get(str(key, 'chave')))
  handle(deps, IPC.setPresets, async (_e, key: unknown, value: unknown) =>
    deps.presets.set(str(key, 'chave'), value as NamespacePresets),
  )

  // Pod Shell: opened only by an explicit user action in the UI (P5); never by the AI.
  handle(deps, IPC.openShell, async (event, raw: unknown) => {
    const req = (raw ?? {}) as Partial<Record<keyof OpenShellRequest, unknown>>
    const context = str(req.context, 'contexto')
    if (service.knownContexts.length === 0) await service.contexts()
    if (isProductionContext(context)) {
      const answer = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['Cancelar', 'Abrir shell'],
        defaultId: 0,
        cancelId: 0,
        message: 'Abrir shell em contexto de PRODUÇÃO?',
        detail: `Contexto: ${context}\nO shell executa comandos reais dentro do container.`,
      })
      if (answer.response !== 1) throw new Error('Abertura do shell cancelada')
    }
    const sender = event.sender
    let shellId = ''
    const shell = new PodShell({
      target: {
        context,
        knownContexts: service.knownContexts,
        namespace: str(req.namespace, 'namespace'),
        pod: str(req.pod, 'pod'),
        container: str(req.container, 'container'),
      },
      cols: optional(req.cols, isNumber, 'cols') ?? 80,
      rows: optional(req.rows, isNumber, 'rows') ?? 24,
      onData: (data) => {
        if (!sender.isDestroyed()) sender.send(IPC.shellData, { shellId, data } satisfies ShellDataEvent)
      },
      onExit: (code) => {
        if (!sender.isDestroyed()) sender.send(IPC.shellExit, { shellId, code } satisfies ShellExitEvent)
        deps.shells.close(shellId)
      },
    })
    shellId = deps.shells.add(shell)
    return shellId
  })

  handle(deps, IPC.shellInput, async (_e, shellId: unknown, data: unknown) => {
    deps.shells.get(str(shellId, 'shellId'))?.write(str(data, 'data'))
  })
  handle(deps, IPC.shellResize, async (_e, shellId: unknown, cols: unknown, rows: unknown) => {
    if (!isNumber(cols) || !isNumber(rows)) throw new Error('tamanho inválido')
    deps.shells.get(str(shellId, 'shellId'))?.resize(cols, rows)
  })
  handle(deps, IPC.closeShell, async (_e, shellId: unknown) => {
    deps.shells.close(str(shellId, 'shellId'))
  })
}
