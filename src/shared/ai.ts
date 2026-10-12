// Types of the "Explicar esses erros" flow shared by main and renderer (no Node imports).

export interface ResponseBlock {
  type: 'text' | 'code' | 'diff'
  lang?: string
  content: string
}

export interface ExplainGroupInput {
  title: string
  count: number
  /** Oldest first. */
  lines: string[]
}

export interface PreviewResult {
  id: string
  /** The user's question after masking, if any. */
  question?: string
  text: string
  lines: number
  bytes: number
  truncated: boolean
  redactions: number
  destination: string
  local: boolean
}

export interface ExplainResult {
  /** Use with followUp(). */
  conversationId: string
  text: string
  blocks: ResponseBlock[]
  writeCommands: string[]
  /** AI self-estimate (0–100); shown as "Estimativa da IA". */
  confidence?: number
}

export type KeyServiceName = 'logdeck-anthropic-api' | 'logdeck-openai-compatible-api'
