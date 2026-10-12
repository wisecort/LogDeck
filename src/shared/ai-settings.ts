// AI provider settings (F7.0). Shared by main and renderer; never contains API keys.

export type ProviderKind = 'none' | 'claude-cli' | 'anthropic' | 'openai'

export interface OpenAiPreset {
  id: string
  name: string
  baseUrl: string
}

export const OPENAI_PRESETS: readonly OpenAiPreset[] = [
  { id: 'ollama', name: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1' },
  { id: 'lmstudio', name: 'LM Studio (local)', baseUrl: 'http://localhost:1234/v1' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com' },
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
  { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1' },
  { id: 'custom', name: 'Personalizado', baseUrl: '' },
]

export interface AiSettings {
  provider: ProviderKind
  /** Empty = the CLI's default model. */
  claudeModel: string
  anthropicModel: string
  openai: { preset: string; baseUrl: string; model: string }
  maskInternalIps: boolean
}

export interface AiStatus {
  settings: AiSettings
  claude: { installed: boolean; version?: string; message?: string }
  hasAnthropicKey: boolean
  hasOpenAiKey: boolean
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'none',
  claudeModel: '',
  anthropicModel: 'claude-opus-5-5',
  openai: { preset: 'ollama', baseUrl: 'http://localhost:11434/v1', model: '' },
  maskInternalIps: false,
}

const PROVIDERS: readonly ProviderKind[] = ['none', 'claude-cli', 'anthropic', 'openai']
export const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,99}$/

const model = (v: unknown, fallback: string) => (typeof v === 'string' && (v === '' || MODEL_RE.test(v)) ? v : fallback)

export function sanitizeAiSettings(raw: unknown, base: AiSettings = DEFAULT_AI_SETTINGS): AiSettings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const o = (typeof r['openai'] === 'object' && r['openai'] !== null ? r['openai'] : {}) as Record<string, unknown>
  const preset = typeof o['preset'] === 'string' && OPENAI_PRESETS.some((p) => p.id === o['preset']) ? o['preset'] : base.openai.preset
  const anthropicModel = model(r['anthropicModel'], base.anthropicModel)
  return {
    provider: PROVIDERS.includes(r['provider'] as ProviderKind) ? (r['provider'] as ProviderKind) : base.provider,
    claudeModel: model(r['claudeModel'], base.claudeModel),
    anthropicModel: anthropicModel || DEFAULT_AI_SETTINGS.anthropicModel,
    openai: {
      preset,
      baseUrl: typeof o['baseUrl'] === 'string' && o['baseUrl'].length <= 300 ? o['baseUrl'] : base.openai.baseUrl,
      model: model(o['model'], base.openai.model),
    },
    maskInternalIps: typeof r['maskInternalIps'] === 'boolean' ? r['maskInternalIps'] : base.maskInternalIps,
  }
}
