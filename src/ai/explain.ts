// "Explicar esses erros" (F7): preview with masking, explicit one-shot send (G6), log as data (G7).
import { randomUUID } from 'node:crypto'
import { buildPayload, buildUserMessage, SYSTEM_PROMPT, type PayloadGroup } from './prompt'
import { redact } from './redact'
import type { ExplainResult, PreviewResult } from '../shared/ai'
import { parseResponse, writeCommands } from './response'
import type { AiProvider } from './types'

export type { ExplainResult, PreviewResult } from '../shared/ai'
export type { AiProvider } from './types'

const MAX_GROUPS = 50
const MAX_LINES_PER_GROUP = 1000
const MAX_LINE_CHARS = 4000
const MAX_TITLE_CHARS = 200
const DEFAULT_TTL_MS = 10 * 60_000

export interface ExplainOptions {
  provider: () => Promise<AiProvider | undefined>
  now?: () => number
  ttlMs?: number
}

/** Groups come from the renderer: validate shape and cap sizes before anything else. */
function parseGroups(raw: unknown): PayloadGroup[] {
  if (!Array.isArray(raw)) throw new Error('grupos inválidos')
  if (raw.length === 0) throw new Error('Selecione ao menos um grupo de erros')
  return raw.slice(0, MAX_GROUPS).map((g) => {
    const { title, count, lines } = (g ?? {}) as Record<string, unknown>
    if (typeof title !== 'string' || typeof count !== 'number' || !Array.isArray(lines) || lines.some((l) => typeof l !== 'string')) {
      throw new Error('grupos inválidos')
    }
    return {
      title: title.slice(0, MAX_TITLE_CHARS),
      count: Math.max(0, Math.floor(count)),
      lines: (lines as string[]).slice(-MAX_LINES_PER_GROUP).map((l) => l.slice(0, MAX_LINE_CHARS)),
    }
  })
}

export class ExplainService {
  private readonly pending = new Map<string, { text: string; destination: string; expires: number }>()
  private readonly now: () => number
  private readonly ttl: number

  constructor(private readonly opts: ExplainOptions) {
    this.now = opts.now ?? Date.now
    this.ttl = opts.ttlMs ?? DEFAULT_TTL_MS
  }

  private async requireProvider(): Promise<AiProvider> {
    const provider = await this.opts.provider()
    if (!provider) throw new Error('Configure um provedor de IA nas Preferências')
    return provider
  }

  async preview(rawGroups: unknown, opts: { maskInternalIps?: boolean }): Promise<PreviewResult> {
    const provider = await this.requireProvider()
    let redactions = 0
    const masked = parseGroups(rawGroups).map((g) => {
      const title = redact(g.title, opts)
      redactions += title.count
      return {
        ...g,
        title: title.text,
        lines: g.lines.map((line) => {
          const r = redact(line, opts)
          redactions += r.count
          return r.text
        }),
      }
    })
    const payload = buildPayload(masked)
    const id = randomUUID()
    for (const [key, entry] of this.pending) if (entry.expires <= this.now()) this.pending.delete(key)
    this.pending.set(id, { text: payload.text, destination: provider.destination, expires: this.now() + this.ttl })
    return { id, ...payload, redactions, destination: provider.destination, local: provider.local }
  }

  /** Sends exactly the previewed text, once. */
  async explain(previewId: string): Promise<ExplainResult> {
    const entry = this.pending.get(previewId)
    this.pending.delete(previewId)
    if (!entry || entry.expires <= this.now()) throw new Error('Preview expirado ou já enviado; gere um novo preview')
    const provider = await this.requireProvider()
    if (provider.destination !== entry.destination) throw new Error('O provedor mudou desde o preview; gere um novo preview')
    const text = await provider.complete(SYSTEM_PROMPT, buildUserMessage(entry.text))
    return { text, blocks: parseResponse(text), writeCommands: writeCommands(text) }
  }

  /** "Testar provedor": fixed prompt, no logs. */
  async test(): Promise<string> {
    const provider = await this.requireProvider()
    return provider.complete(SYSTEM_PROMPT, 'Responda apenas OK')
  }
}
