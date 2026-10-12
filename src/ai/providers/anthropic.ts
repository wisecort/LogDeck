// Anthropic API through the official SDK (F7.0, ADR 0002). Billed per token.
import Anthropic from '@anthropic-ai/sdk'

export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5-5'
const MODEL_RE = /^[a-z0-9][a-z0-9.-]{1,63}$/
const DEFAULT_TIMEOUT_MS = 120_000

export interface AnthropicConfig {
  apiKey: string
  model?: string
  /** Tests only: points the SDK at a fake server. */
  baseURL?: string
}

export async function anthropicMessage(config: AnthropicConfig, system: string, user: string, opts: { timeoutMs?: number } = {}): Promise<string> {
  if (!config.apiKey) throw new Error('Configure a chave da API da Anthropic nas Preferências')
  const model = config.model || DEFAULT_ANTHROPIC_MODEL
  if (!MODEL_RE.test(model)) throw new Error('Nome de modelo inválido')
  const client = new Anthropic({
    apiKey: config.apiKey,
    ...(config.baseURL && { baseURL: config.baseURL }),
    timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: 1,
  })
  let response
  try {
    response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system,
      messages: [{ role: 'user', content: user }],
    })
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error('Chave da API da Anthropic inválida ou expirada (HTTP 401)', { cause: err })
    if (err instanceof Anthropic.PermissionDeniedError) throw new Error('Sem permissão na API da Anthropic (HTTP 403)', { cause: err })
    if (err instanceof Anthropic.RateLimitError) throw new Error('Limite de uso da API da Anthropic atingido (HTTP 429)', { cause: err })
    if (err instanceof Anthropic.APIConnectionTimeoutError) throw new Error('API da Anthropic: tempo esgotado', { cause: err })
    if (err instanceof Anthropic.APIConnectionError) throw new Error('Não foi possível conectar à API da Anthropic', { cause: err })
    if (err instanceof Anthropic.APIError) throw new Error(`API da Anthropic: ${err.message}`, { cause: err })
    throw err
  }
  if (response.stop_reason === 'refusal') throw new Error('O modelo recusou a solicitação (stop_reason: refusal)')
  const text = response.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('\n')
    .trim()
  if (!text) throw new Error('API da Anthropic: resposta vazia')
  return text
}
