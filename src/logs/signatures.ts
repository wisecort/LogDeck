import { displayTime } from './classify'
import { entryText } from './search'
import type { LogEntry } from './types'

export interface SignatureMatch {
  id: string
  title: string
}

export interface SignatureGroup extends SignatureMatch {
  /** `id` for catalog rules, `generic:<normalized message>` otherwise. */
  key: string
  count: number
  firstTime?: number
  lastTime?: number
  sample: string
  seqs: number[]
}

interface Rule extends SignatureMatch {
  re: RegExp
}

/** Catalog written by the team (SPEC F6.2). First match wins; any level. */
const RULES: readonly Rule[] = [
  { id: 'apache-phpfpm-timeout', title: 'Timeout Apache → PHP-FPM', re: /\bAH01075\b|proxy_fcgi.*\(70007\)/ },
  {
    id: 'startup-permission',
    title: 'Permissão no startup',
    re: /\b(?:chown|chmod|mkdir)\b.*(?:Operation not permitted|Permission denied)/,
  },
  { id: 'nginx-upstream-timeout', title: 'Timeout upstream (Nginx)', re: /upstream timed out/i },
  { id: 'node-etimedout', title: 'Timeout de conexão', re: /\b(?:ETIMEDOUT|ESOCKETTIMEDOUT)\b/ },
  { id: 'fpm-max-children', title: 'PHP-FPM sem workers', re: /server reached pm\.max_children/ },
  { id: 'php-fatal', title: 'PHP Fatal error', re: /PHP Fatal error/ },
]

const TIMEOUT = /\btimed? ?out\b|\btimeout\b/i
const GENERIC_TITLE_MAX = 120

/** Catalog rule first, then `generic` for ERROR/FATAL/timeout entries; null otherwise. */
export function matchSignature(entry: LogEntry): SignatureMatch | null {
  const text = entryText(entry)
  const rule = RULES.find((r) => r.re.test(text))
  if (rule) return { id: rule.id, title: rule.title }
  if (entry.level === 'ERROR' || entry.level === 'FATAL' || TIMEOUT.test(text)) {
    return { id: 'generic', title: normalizeMessage(entry.message).slice(0, GENERIC_TITLE_MAX) }
  }
  return null
}

const NORMALIZERS: ReadonlyArray<[RegExp, string]> = [
  [/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, '<ts>'],
  [/\[\w{3} \w{3} \d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)? \d{4}\]/g, '[<ts>]'],
  [/\[\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4}\]/g, '[<ts>]'],
  [/\[\d{2}-\w{3}-\d{4} \d{2}:\d{2}:\d{2}(?:\.\d+)?\]/g, '[<ts>]'],
  [/\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/g, '<ts>'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>'],
  [/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '<ip>'],
  [/\b0x[0-9a-f]+\b/gi, '<hex>'],
  // Standalone numbers only, so codes such as AH01075 keep their identity.
  [/\b\d+\b/g, '<n>'],
  [/\s+/g, ' '],
]

/** Replaces timestamps, IPs, numbers, hex and UUIDs with placeholders. */
export function normalizeMessage(text: string): string {
  return NORMALIZERS.reduce((acc, [re, to]) => acc.replace(re, to), text).trim()
}

export class SignatureIndex {
  private readonly byKey = new Map<string, SignatureGroup>()

  add(entry: LogEntry): void {
    const match = matchSignature(entry)
    if (!match) return
    const key = match.id === 'generic' ? `generic:${normalizeMessage(entry.message)}` : match.id
    const time = displayTime(entry).time
    let group = this.byKey.get(key)
    if (!group) {
      group = { ...match, key, count: 0, sample: entry.raw, seqs: [] }
      this.byKey.set(key, group)
    }
    group.count++
    group.seqs.push(entry.seq)
    if (time !== undefined) {
      if (group.firstTime === undefined || time < group.firstTime) group.firstTime = time
      if (group.lastTime === undefined || time > group.lastTime) group.lastTime = time
    }
  }

  addMany(entries: readonly LogEntry[]): void {
    for (const entry of entries) this.add(entry)
  }

  /** Sorted by count, descending; ties by most recent. */
  groups(): SignatureGroup[] {
    return [...this.byKey.values()].sort((a, b) => b.count - a.count || (b.lastTime ?? 0) - (a.lastTime ?? 0))
  }

  clear(): void {
    this.byKey.clear()
  }
}
