// OpenAI-compatible Chat Completions (Ollama, LM Studio, DeepSeek, OpenRouter, Groq...) via fetch (F7.0).
export { OPENAI_PRESETS } from '../../shared/ai-settings'

const DEFAULT_TIMEOUT_MS = 120_000
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export interface ChatConfig {
  baseUrl: string
  model: string
  apiKey?: string
}

/** HTTPS only, except for localhost; no credentials inside the URL (G6). */
export function validateBaseUrl(url: string): string {
  let u: URL
  try {
    u = new URL(url)
  } catch (err) {
    throw new Error('URL base inválida', { cause: err })
  }
  if (u.username || u.password) throw new Error('A URL base não pode conter usuário ou senha')
  const local = LOCAL_HOSTS.has(u.hostname)
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) throw new Error('Use HTTPS (HTTP só para localhost)')
  return url.replace(/\/+$/, '')
}

export function destinationOf(baseUrl: string): { label: string; local: boolean } {
  const u = new URL(baseUrl)
  return LOCAL_HOSTS.has(u.hostname) ? { label: `Local · ${u.host} (não sai da máquina)`, local: true } : { label: u.host, local: false }
}

function httpError(status: number): string {
  if (status === 401 || status === 403) return `Chave inválida ou sem permissão (HTTP ${status})`
  if (status === 404) return 'Endpoint ou modelo não encontrado (HTTP 404)'
  if (status === 429) return 'Limite de uso atingido (HTTP 429)'
  return `Erro do provedor (HTTP ${status})`
}

export async function chatCompletion(config: ChatConfig, system: string, user: string, opts: { timeoutMs?: number } = {}): Promise<string> {
  const base = validateBaseUrl(config.baseUrl)
  if (!config.model) throw new Error('Informe o modelo nas Preferências')
  const host = new URL(base).host
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(config.apiKey && { authorization: `Bearer ${config.apiKey}` }) },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error(`${host}: tempo esgotado`, { cause: err })
    throw new Error(`Não foi possível conectar a ${host}`, { cause: err })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new Error(httpError(res.status))
  const body = (await res.json().catch(() => ({}))) as { choices?: Array<{ message?: { content?: unknown } }> }
  const content = body.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content) throw new Error('Resposta inesperada do provedor')
  return content
}
