import type { AiSettings } from '../../shared/ai-settings'
import type { AiProvider } from '../types'
import { anthropicMessage } from './anthropic'
import { runClaude } from './claude-cli'
import type { SecretStore } from './secrets'
import { chatCompletion, destinationOf, validateBaseUrl } from './openai-compatible'

export interface ProviderDeps {
  keychain: SecretStore
  env?: NodeJS.ProcessEnv
  claudeBinary?: string
  /** Tests only. */
  anthropicBaseURL?: string
}

/** Binds the selected provider to its credentials; undefined when none is configured. */
export async function createProvider(settings: AiSettings, deps: ProviderDeps): Promise<AiProvider | undefined> {
  switch (settings.provider) {
    case 'claude-cli':
      return {
        destination: 'Claude Code CLI · sua conta Anthropic',
        local: false,
        complete: (system, user) =>
          runClaude(system, user, {
            ...(deps.env && { env: deps.env }),
            ...(deps.claudeBinary && { binary: deps.claudeBinary }),
            ...(settings.claudeModel && { model: settings.claudeModel }),
          }),
      }
    case 'anthropic': {
      const apiKey = await deps.keychain.get('logdeck-anthropic-api')
      if (!apiKey) throw new Error('Configure a chave da API da Anthropic nas Preferências')
      return {
        destination: 'API da Anthropic · api.anthropic.com',
        local: false,
        complete: (system, user) =>
          anthropicMessage({ apiKey, model: settings.anthropicModel, ...(deps.anthropicBaseURL && { baseURL: deps.anthropicBaseURL }) }, system, user),
      }
    }
    case 'openai': {
      const baseUrl = validateBaseUrl(settings.openai.baseUrl)
      const apiKey = await deps.keychain.get('logdeck-openai-compatible-api')
      const dest = destinationOf(baseUrl)
      return {
        destination: dest.label,
        local: dest.local,
        complete: (system, user) => chatCompletion({ baseUrl, model: settings.openai.model, ...(apiKey && { apiKey }) }, system, user),
      }
    }
    default:
      return undefined
  }
}
