// API keys in the macOS Keychain via /usr/bin/security (ADR 0002). Only LogDeck items are touched.
import { userInfo } from 'node:os'
import { runProcess } from './process'
import { assertKey, assertKeyService, type KeyService, type SecretStore } from './secrets'

export { KEY_SERVICES, type KeyService } from './secrets'

const LABELS: Record<KeyService, string> = {
  'logdeck-anthropic-api': 'LogDeck — Anthropic API key',
  'logdeck-openai-compatible-api': 'LogDeck — OpenAI-compatible API key',
}
const NOT_FOUND = 44

export interface KeychainOptions {
  binary?: string
  env?: NodeJS.ProcessEnv
  account?: string
}

export class Keychain implements SecretStore {
  private readonly binary: string
  private readonly account: string

  constructor(private readonly opts: KeychainOptions = {}) {
    this.binary = opts.binary ?? '/usr/bin/security'
    this.account = opts.account ?? userInfo().username
  }

  private check(service: string): asserts service is KeyService {
    assertKeyService(service)
  }

  private run(args: string[]) {
    return runProcess(this.binary, args, { ...(this.opts.env && { env: this.opts.env }), timeoutMs: 15_000 })
  }

  async get(service: KeyService): Promise<string | undefined> {
    this.check(service)
    const r = await this.run(['find-generic-password', '-a', this.account, '-s', service, '-w'])
    if (r.code === NOT_FOUND) return undefined
    if (r.code !== 0) throw new Error(`Keychain: ${r.stderr.trim() || `código ${r.code}`}`)
    const key = r.stdout.replace(/\r?\n$/, '')
    return key || undefined
  }

  async has(service: KeyService): Promise<boolean> {
    return (await this.get(service)) !== undefined
  }

  /** Note: the key is passed as an argument to `security` for a few milliseconds (ADR 0002). */
  async set(service: KeyService, key: string): Promise<void> {
    this.check(service)
    assertKey(key)
    const r = await this.run(['add-generic-password', '-a', this.account, '-s', service, '-l', LABELS[service], '-U', '-w', key])
    if (r.code !== 0) throw new Error(`Keychain: ${r.stderr.trim() || `código ${r.code}`}`)
  }

  async delete(service: KeyService): Promise<void> {
    this.check(service)
    const r = await this.run(['delete-generic-password', '-a', this.account, '-s', service])
    if (r.code !== 0 && r.code !== NOT_FOUND) throw new Error(`Keychain: ${r.stderr.trim() || `código ${r.code}`}`)
  }
}
