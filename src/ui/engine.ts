// Renderer-side log model: assembly, ring buffer, error groups and the filtered view.
// Pure TypeScript (no DOM) so it is unit-tested in Node.
import { LogBuffer } from '../logs/buffer'
import { LogAssembler, timelineTime } from '../logs/classify'
import { collapseRows, type Row } from '../logs/collapse'
import { entryText, type CompiledSearch } from '../logs/search'
import { SignatureIndex, type SignatureGroup } from '../logs/signatures'
import type { Level, LogEntry } from '../logs/types'

export interface ViewFilter {
  levels: ReadonlySet<Level>
  /** Plain-text search and exclusions. */
  search?: CompiledSearch
  /** Regex results computed in a worker (seqs); replaces `search.matches` when present. */
  regexMatches?: ReadonlySet<number>
  /** Restrict to an error group from the F6 panel. */
  groupSeqs?: ReadonlySet<number>
  /** [from, to] epoch ms, inclusive (histogram selection). */
  timeRange?: readonly [number, number]
  /** Pods turned off in a tab that reads several replicas. */
  hiddenPods?: ReadonlySet<string>
  collapse: boolean
}

/** Order of lines from several pods: the kubectl `--timestamps` time, else the log's own, else arrival. */
const mergeTime = (e: LogEntry) => e.k8sTime ?? e.logTime ?? e.ingestTime

export interface EngineOptions {
  capacity?: number
  now?: () => number
}

export class LogEngine {
  private assembler: LogAssembler
  private buffer: LogBuffer
  private signatures = new SignatureIndex()
  private changes = 0
  // Several pods (ingest with a source): one assembler per pod so each stack trace stays on its entry,
  // one shared sequence, and lines held in `pending` until flush() puts them in time order.
  private sources = new Map<string, { assembler: LogAssembler; last?: LogEntry; sentAt?: number; latest?: number }>()
  private pending: LogEntry[] = []
  private seq = 1
  private perPod = new Map<string, number>()
  private defaultLevel: Level | undefined

  constructor(private readonly opts: EngineOptions = {}) {
    this.assembler = new LogAssembler({ ...(opts.now && { now: opts.now }) })
    this.buffer = new LogBuffer({ ...(opts.capacity && { capacity: opts.capacity }) })
  }

  /** Lines kept before the oldest are dropped. */
  get capacity(): number {
    return this.buffer.capacity
  }

  /** Increments on every change; cheap memo key for the UI. */
  get version(): number {
    return this.changes
  }

  get size(): number {
    return this.buffer.size
  }

  get dropped(): number {
    return this.buffer.dropped
  }

  get counts(): Readonly<Record<Level, number>> {
    return this.buffer.counts
  }

  /** Timeline time of the newest entry, if it has one. */
  get lastTime(): number | undefined {
    const last = this.buffer.at(this.buffer.size - 1)
    return last && timelineTime(last)
  }

  /** Lines received per pod (several replicas in one tab). */
  get podCounts(): ReadonlyMap<string, number> {
    return this.perPod
  }

  /** `source`: the pod the lines came from, when the tab reads several; they wait in order for flush(). */
  ingest(lines: readonly string[], source?: string): void {
    if (source !== undefined) return this.ingestFrom(source, lines)
    for (const line of lines) {
      const event = this.assembler.push(line)
      if (event.type === 'entry') {
        this.buffer.push(event.entry)
        this.signatures.add(event.entry)
      } else {
        this.buffer.appendContinuation(event.seq, event.text)
      }
    }
    this.changes++
  }

  private ingestFrom(source: string, lines: readonly string[]): void {
    let s = this.sources.get(source)
    if (!s) {
      const assembler = new LogAssembler({ ...(this.opts.now && { now: this.opts.now }), ...(this.defaultLevel && { defaultLevel: this.defaultLevel }), nextSeq: () => this.seq++ })
      s = { assembler }
      this.sources.set(source, s)
    }
    s.sentAt = (this.opts.now ?? Date.now)()
    for (const line of lines) {
      const event = s.assembler.push(line)
      if (event.type === 'entry') {
        event.entry.pod = source
        s.last = event.entry
        s.latest = Math.max(s.latest ?? -Infinity, mergeTime(event.entry))
        this.pending.push(event.entry)
      } else if (s.last) {
        // Same object in `pending` or in the buffer: the trace lands on its entry either way.
        s.last.continuation.push(event.text)
        this.changes++
      }
    }
  }

  /**
   * Moves the lines from several pods that arrived at least `holdMs` before `now` into the list, in time
   * order, so a pod a bit slower than the others does not land out of place. True when lines were added.
   */
  flush(now: number, holdMs: number): boolean {
    const cut = now - holdMs
    // A pod that sent lines within holdMs may still be sending its backlog: lines of the others newer than
    // what it covers wait for it (at most 10× holdMs), so a slow kubectl does not push its pod to the end.
    let watermark = Infinity
    for (const s of this.sources.values()) if ((s.sentAt ?? -Infinity) > cut && s.latest !== undefined) watermark = Math.min(watermark, s.latest)
    const isReady = (e: LogEntry) => e.ingestTime <= cut && (mergeTime(e) <= watermark || e.ingestTime <= now - holdMs * 10)
    const ready = this.pending.filter(isReady)
    if (ready.length === 0) return false
    this.pending = this.pending.filter((e) => !isReady(e))
    ready.sort((a, b) => mergeTime(a) - mergeTime(b) || a.seq - b.seq)
    for (const e of ready) {
      this.buffer.push(e)
      this.signatures.add(e)
      this.perPod.set(e.pod!, (this.perPod.get(e.pod!) ?? 0) + 1)
    }
    this.changes++
    return true
  }

  entries(): LogEntry[] {
    return this.buffer.toArray()
  }

  groups(): SignatureGroup[] {
    return this.signatures.groups()
  }

  /** The entry with this sequence number, through the buffer's own index (no copy of all entries). */
  bySeq(seq: number): LogEntry | undefined {
    return this.buffer.bySeq(seq)
  }

  /** Entries passing the filter, in order; reads the buffer in place (a file can hold millions). */
  viewEntries(filter: Omit<ViewFilter, 'collapse'>): LogEntry[] {
    const { levels, search, regexMatches, groupSeqs, timeRange, hiddenPods } = filter
    const visible: LogEntry[] = []
    for (let i = 0; i < this.buffer.size; i++) {
      const e = this.buffer.at(i)!
      if (!levels.has(e.level)) continue
      if (hiddenPods && e.pod !== undefined && hiddenPods.has(e.pod)) continue
      if (groupSeqs && !groupSeqs.has(e.seq)) continue
      if (timeRange) {
        const t = timelineTime(e)
        if (t === undefined || t < timeRange[0] || t > timeRange[1]) continue
      }
      if (regexMatches && !regexMatches.has(e.seq)) continue
      if (search) {
        const text = entryText(e)
        if (search.excluded(text)) continue
        if (!regexMatches && !search.matches(text)) continue
      }
      visible.push(e)
    }
    return visible
  }

  view(filter: ViewFilter): Row[] {
    const visible = this.viewEntries(filter)
    return filter.collapse ? collapseRows(visible) : visible.map((entry) => ({ entry, count: 1 }))
  }

  /** Starts over; `defaultLevel` is the level of lines no parser recognizes (INFO for OKD build pods). */
  clear(defaultLevel?: Level): void {
    this.assembler = new LogAssembler({ ...(this.opts.now && { now: this.opts.now }), ...(defaultLevel && { defaultLevel }) })
    this.buffer.clear()
    this.signatures.clear()
    this.defaultLevel = defaultLevel
    this.sources.clear()
    this.pending = []
    this.seq = 1
    this.perPod = new Map()
    this.changes++
  }
}
