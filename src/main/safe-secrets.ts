// Windows/Linux: API keys encrypted with the OS vault through Electron safeStorage (DPAPI, libsecret, KWallet),
// stored in userData/secrets.json (0600). Without a real vault (Linux "basic_text") nothing is stored.
import { chmodSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { assertKey, assertKeyService, type KeyService, type SecretStore } from '../ai/providers/secrets'

export interface Cipher {
  isAvailable(): boolean
  /** Electron's getSelectedStorageBackend() on Linux; any other value elsewhere. */
  backend(): string
  encrypt(text: string): Buffer
  decrypt(data: Buffer): string
}

const NO_VAULT = 'Sem cofre de senhas do sistema para guardar a chave com segurança (no Linux, instale e desbloqueie o GNOME Keyring ou o KWallet).'

export class EncryptedFileStore implements SecretStore {
  constructor(
    private readonly file: string,
    private readonly cipher: Cipher,
  ) {}

  private read(): Record<string, string> {
    try {
      const raw = JSON.parse(readFileSync(this.file, 'utf8')) as unknown
      return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, string>) : {}
    } catch {
      return {}
    }
  }

  private write(data: Record<string, string>): void {
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 })
    chmodSync(tmp, 0o600)
    renameSync(tmp, this.file)
  }

  private secure(): boolean {
    return this.cipher.isAvailable() && this.cipher.backend() !== 'basic_text'
  }

  async get(service: KeyService): Promise<string | undefined> {
    assertKeyService(service)
    const value = this.read()[service]
    if (!value || !this.cipher.isAvailable()) return undefined
    try {
      return this.cipher.decrypt(Buffer.from(value, 'base64')) || undefined
    } catch {
      return undefined
    }
  }

  async has(service: KeyService): Promise<boolean> {
    return (await this.get(service)) !== undefined
  }

  async set(service: KeyService, key: string): Promise<void> {
    assertKeyService(service)
    assertKey(key)
    if (!this.secure()) throw new Error(NO_VAULT)
    this.write({ ...this.read(), [service]: this.cipher.encrypt(key).toString('base64') })
  }

  async delete(service: KeyService): Promise<void> {
    assertKeyService(service)
    const data = this.read()
    if (!(service in data)) return
    delete data[service]
    this.write(data)
  }
}
