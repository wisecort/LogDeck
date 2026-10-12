// Where AI API keys live. macOS: Keychain (keychain.ts). Windows/Linux: OS vault via Electron safeStorage (main/safe-secrets.ts).
export const KEY_SERVICES = ['logdeck-anthropic-api', 'logdeck-openai-compatible-api'] as const
export type KeyService = (typeof KEY_SERVICES)[number]

export interface SecretStore {
  get(service: KeyService): Promise<string | undefined>
  has(service: KeyService): Promise<boolean>
  set(service: KeyService, key: string): Promise<void>
  delete(service: KeyService): Promise<void>
}

export function assertKeyService(service: string): asserts service is KeyService {
  if (!(KEY_SERVICES as readonly string[]).includes(service)) throw new Error(`item do cofre não permitido: ${service}`)
}

export function assertKey(key: unknown): asserts key is string {
  // eslint-disable-next-line no-control-regex -- control characters are rejected on purpose
  if (typeof key !== 'string' || key.length === 0 || key.length > 4096 || /[\u0000-\u001f\u007f]/.test(key)) throw new Error('chave inválida')
}
