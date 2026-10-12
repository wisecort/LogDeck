// "Explicar esses erros" (F7): preview with masking, explicit one-shot send (G6), log as data (G7).
import { randomUUID } from 'node:crypto'
import { buildPayload, buildUserMessage, systemPrompt, type PayloadGroup, type Turn } from './prompt'
import { redact } from './redact'
import type { ExplainResult, PreviewResult } from '../shared/ai'
import { extractConfidence, parseResponse, writeCommands } from './response'
import type { AiProvider } from './types'

export type { ExplainResult, PreviewResult } from '../shared/ai'
export type { AiProvider } from './types'

const MAX_GROUPS = 50
const MAX_LINES_PER_GROUP = 1000
const MAX_LINE_CHARS = 4000
const MAX_TITLE_CHARS = 200
const DEFAULT_TTL_MS = 10 * 60_000
const CONVERSATION_TTL_MS = 60 * 60_000
const MAX_QUESTION_CHARS = 2000
const MAX_TURNS = 10

export interface ExplainOptions {
  provider: () => Promise<AiProvider | undefined>
  now?: () => number
  ttlMs?: number
  /** Interface language: the answer comes in it (default pt-BR). */
  language?: () => string
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

function cleanQuestion(q: unknown, opts: { maskInternalIps?: boolean }): string | undefined {
  if (q === undefined || q === null) return undefined
  if (typeof q !== 'string') throw new Error('pergunta inválida')
  const trimmed = q.trim().slice(0, MAX_QUESTION_CHARS)
  return trimmed ? redact(trimmed, opts).text : undefined
}

interface Conversation {
  logs: string
  destination: string
  maskInternalIps: boolean
  turns: Turn[]
  expires: number
}

export class ExplainService {
  private readonly pending = new Map<string, { text: string; question?: string; destination: string; maskInternalIps: boolean; expires: number }>()
  private readonly conversations = new Map<string, Conversation>()
  private readonly now: () => number
  private readonly ttl: number

  constructor(private readonly opts: ExplainOptions) {
    this.now = opts.now ?? Date.now
    this.ttl = opts.ttlMs ?? DEFAULT_TTL_MS
  }

  private system(): string {
    return systemPrompt(this.opts.language?.() ?? 'pt-BR')
  }

  private async requireProvider(): Promise<AiProvider> {
    const provider = await this.opts.provider()
    if (!provider) throw new Error('Configure um provedor de IA nas Preferências')
    return provider
  }

  async preview(rawGroups: unknown, opts: { maskInternalIps?: boolean; question?: string }): Promise<PreviewResult> {
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
    const question = cleanQuestion(opts.question, opts)
    const id = randomUUID()
    for (const [key, entry] of this.pending) if (entry.expires <= this.now()) this.pending.delete(key)
    this.pending.set(id, {
      text: payload.text,
      ...(question && { question }),
      destination: provider.destination,
      maskInternalIps: opts.maskInternalIps === true,
      expires: this.now() + this.ttl,
    })
    return { id, ...(question && { question }), ...payload, redactions, destination: provider.destination, local: provider.local }
  }

  private result(conversationId: string, text: string): ExplainResult {
    const confidence = extractConfidence(text)
    return { conversationId, text, blocks: parseResponse(text), writeCommands: writeCommands(text), ...(confidence !== undefined && { confidence }) }
  }

  /** Sends exactly the previewed text, once. */
  async explain(previewId: string): Promise<ExplainResult> {
    const entry = this.pending.get(previewId)
    this.pending.delete(previewId)
    if (!entry || entry.expires <= this.now()) throw new Error('Preview expirado ou já enviado; gere um novo preview')
    const provider = await this.requireProvider()
    if (provider.destination !== entry.destination) throw new Error('O provedor mudou desde o preview; gere um novo preview')
    const text = await provider.complete(this.system(), buildUserMessage(entry.text, { ...(entry.question && { question: entry.question }) }))
    const conversationId = randomUUID()
    for (const [key, c] of this.conversations) if (c.expires <= this.now()) this.conversations.delete(key)
    this.conversations.set(conversationId, {
      logs: entry.text,
      destination: entry.destination,
      maskInternalIps: entry.maskInternalIps,
      turns: [{ ...(entry.question && { question: entry.question }), answer: text }],
      expires: this.now() + CONVERSATION_TTL_MS,
    })
    return this.result(conversationId, text)
  }

  /** Follow-up on logs already approved in the preview; only the new question is added. */
  async followUp(conversationId: string, rawQuestion: string): Promise<ExplainResult> {
    const c = this.conversations.get(conversationId)
    if (!c || c.expires <= this.now()) throw new Error('Conversa expirada; gere uma nova explicação')
    const question = cleanQuestion(rawQuestion, { maskInternalIps: c.maskInternalIps })
    if (!question) throw new Error('Digite uma pergunta')
    if (c.turns.length >= MAX_TURNS) throw new Error('Limite de perguntas nesta conversa; gere uma nova explicação')
    const provider = await this.requireProvider()
    if (provider.destination !== c.destination) throw new Error('O provedor mudou; gere uma nova explicação')
    const text = await provider.complete(this.system(), buildUserMessage(c.logs, { history: c.turns, question }))
    c.turns.push({ question, answer: text })
    c.expires = this.now() + CONVERSATION_TTL_MS
    return this.result(conversationId, text)
  }

  /** "Testar provedor": fixed prompt, no logs. */
  async test(): Promise<string> {
    const provider = await this.requireProvider()
    return provider.complete(this.system(), 'Responda apenas OK')
  }
}
