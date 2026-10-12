import type { ChildProcess } from 'node:child_process'
import { buildLogsArgs, type LogsOptions, type PodTarget } from './args'
import type { StreamStatus } from '../shared/ipc'
import { friendlyError, spawnKubectl, type KubectlOptions } from './kubectl'

export const BACKOFF_MS: readonly number[] = [1000, 2000, 5000, 10_000]
export const BATCH_MS = 100
const KILL_GRACE_MS = 2000

export type { StreamStatus } from '../shared/ipc'

export type Schedule = (fn: () => void, ms: number) => () => void

export interface LogStreamOptions {
  target: PodTarget
  tail?: number
  since?: string
  previous?: boolean
  kubectl?: KubectlOptions
  batchMs?: number
  backoffMs?: readonly number[]
  /** Reconnection timer; injectable for tests. */
  schedule?: Schedule
  onLines(lines: string[]): void
  onStatus(status: StreamStatus): void
}

const defaultSchedule: Schedule = (fn, ms) => {
  const t = setTimeout(fn, ms)
  return () => clearTimeout(t)
}

const K8S_TS = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z /
const FATAL = /Unauthorized|must be logged in|token has expired|Forbidden/i
const GONE = /NotFound|not found/i

/** RFC3339Nano prefix → nanoseconds since epoch (string compare fails with trimmed zeros). */
function timestampOf(line: string): { text: string; ns: bigint } | undefined {
  const m = K8S_TS.exec(line)
  if (!m) return undefined
  const ms = Date.parse(`${m[1]}Z`)
  if (Number.isNaN(ms)) return undefined
  const frac = (m[2] ?? '').padEnd(9, '0')
  return { text: line.slice(0, line.indexOf(' ')), ns: BigInt(ms) * 1_000_000n + BigInt(frac) }
}

/** `kubectl logs -f --timestamps` with batching, reconnection and clean shutdown (F3). */
export class LogStream {
  private child: ChildProcess | undefined
  private started = false
  private stopped = false
  private final = false
  private attempt = 0
  private partial = ''
  private pending: string[] = []
  private batchTimer: ReturnType<typeof setTimeout> | undefined
  private cancelRetry: (() => void) | undefined
  private closed: Promise<void> = Promise.resolve()
  // Newest timestamp delivered, and lines already delivered with that same timestamp.
  private lastTs: { text: string; ns: bigint } | undefined
  private seenAtLastTs = new Set<string>()
  // True right after a reconnect, until a line newer than lastTs arrives.
  private resuming = false

  constructor(private readonly opts: LogStreamOptions) {}

  get pid(): number | undefined {
    return this.child?.pid
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.emit({ state: 'connecting' })
    this.connect()
  }

  async stop(): Promise<void> {
    this.stopped = true
    this.cancelRetry?.()
    this.cancelRetry = undefined
    const child = this.child
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM')
      const force = setTimeout(() => child.kill('SIGKILL'), KILL_GRACE_MS)
      await this.closed
      clearTimeout(force)
    }
    this.flush()
    this.emit({ state: 'ended' })
  }

  private emit(status: StreamStatus): void {
    if (this.final) return
    if (status.state === 'ended' || status.state === 'error') this.final = true
    this.opts.onStatus(status)
  }

  private logsOptions(): LogsOptions {
    // After a drop, resume right after the last delivered line instead of re-reading the tail.
    if (this.lastTs) return { follow: true, sinceTime: this.lastTs.text }
    const { tail, since, previous } = this.opts
    return { follow: !previous, ...(tail !== undefined && { tail }), ...(since !== undefined && { since }), ...(previous && { previous }) }
  }

  private connect(): void {
    const child = spawnKubectl(buildLogsArgs(this.opts.target, this.logsOptions()), this.opts.kubectl)
    this.child = child
    let stderr = ''
    let spawnError: Error | undefined
    this.closed = new Promise((resolve) => {
      child.on('close', (code) => {
        resolve()
        this.onExit(code, spawnError ? friendlyError(spawnError) : stderr)
      })
    })
    child.on('spawn', () => {
      if (!this.stopped) this.emit({ state: 'live' })
    })
    child.on('error', (err) => {
      spawnError = err
    })
    child.stdout!.setEncoding('utf8').on('data', (chunk: string) => this.onData(chunk))
    child.stderr!.setEncoding('utf8').on('data', (d: string) => (stderr += d))
  }

  private onData(chunk: string): void {
    const parts = (this.partial + chunk).split('\n')
    this.partial = parts.pop()!
    for (const line of parts) this.accept(line.endsWith('\r') ? line.slice(0, -1) : line)
  }

  private accept(line: string): void {
    const ts = timestampOf(line)
    // --since-time may replay lines we already delivered; drop them until we pass lastTs.
    if (this.resuming && ts && this.lastTs) {
      if (ts.ns < this.lastTs.ns) return
      if (ts.ns === this.lastTs.ns && this.seenAtLastTs.has(line)) return
      if (ts.ns > this.lastTs.ns) this.resuming = false
    }
    if (ts) {
      if (!this.lastTs || ts.ns > this.lastTs.ns) {
        this.lastTs = ts
        this.seenAtLastTs = new Set()
      }
      if (ts.ns === this.lastTs.ns) this.seenAtLastTs.add(line)
    }
    this.attempt = 0
    this.pending.push(line)
    this.batchTimer ??= setTimeout(() => this.flush(), this.opts.batchMs ?? BATCH_MS)
  }

  private flush(): void {
    if (this.batchTimer) clearTimeout(this.batchTimer)
    this.batchTimer = undefined
    if (this.pending.length === 0) return
    const lines = this.pending
    this.pending = []
    this.opts.onLines(lines)
  }

  private onExit(code: number | null, stderr: string): void {
    if (this.partial) {
      this.accept(this.partial)
      this.partial = ''
    }
    this.flush()
    this.child = undefined
    if (this.stopped || this.final) return

    const message = stderr.trim() ? friendlyError(stderr) : undefined
    if (this.opts.previous) return this.emit({ state: 'ended', ...(message && code !== 0 && { message }) })
    if (FATAL.test(stderr) || /ENOENT|não encontrado. Instale/.test(stderr)) return this.emit({ state: 'error', message: message! })
    if (GONE.test(stderr)) return this.emit({ state: 'ended', message: message! })

    const backoff = this.opts.backoffMs ?? BACKOFF_MS
    this.attempt++
    const delay = backoff[Math.min(this.attempt, backoff.length) - 1]!
    this.emit({ state: 'reconnecting', attempt: this.attempt, retryInMs: delay, message: message ?? 'Conexão encerrada' })
    this.cancelRetry = (this.opts.schedule ?? defaultSchedule)(() => {
      this.cancelRetry = undefined
      if (this.stopped) return
      this.resuming = this.lastTs !== undefined
      this.connect()
    }, delay)
  }
}

/** Keeps every open stream so that closing a tab or the app kills its kubectl (F3.5). */
export class StreamRegistry {
  private readonly streams = new Map<string, LogStream>()
  private nextId = 1

  add(stream: LogStream): string {
    const id = `stream-${this.nextId++}`
    this.streams.set(id, stream)
    return id
  }

  get(id: string): LogStream | undefined {
    return this.streams.get(id)
  }

  async stop(id: string): Promise<void> {
    const stream = this.streams.get(id)
    this.streams.delete(id)
    await stream?.stop()
  }

  async stopAll(): Promise<void> {
    const all = [...this.streams.values()]
    this.streams.clear()
    await Promise.all(all.map((s) => s.stop()))
  }

  get size(): number {
    return this.streams.size
  }
}
