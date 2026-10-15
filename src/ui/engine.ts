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
  collapse: boolean
}

export interface EngineOptions {
  capacity?: number
  now?: () => number
}

export class LogEngine {
  private assembler: LogAssembler
  private buffer: LogBuffer
  private signatures = new SignatureIndex()
  private changes = 0

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

  ingest(lines: readonly string[]): void {
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
    const { levels, search, regexMatches, groupSeqs, timeRange } = filter
    const visible: LogEntry[] = []
    for (let i = 0; i < this.buffer.size; i++) {
      const e = this.buffer.at(i)!
      if (!levels.has(e.level)) continue
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
    this.changes++
  }
}
