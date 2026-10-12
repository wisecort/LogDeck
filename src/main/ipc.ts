import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron'
import type { K8sService } from '../k8s/service'
import { LogStream, type StreamRegistry } from '../k8s/stream'
import { IPC, type IpcResult, type LogLinesEvent, type LogStatusEvent, type StartLogsRequest } from '../shared/ipc'

export interface IpcDeps {
  service: K8sService
  registry: StreamRegistry
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
}
