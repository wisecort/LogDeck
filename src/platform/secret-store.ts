// Which vault holds the AI keys on each OS (main process only).
import { join } from 'node:path'
import { safeStorage } from 'electron'
import { Keychain } from '../ai/providers/keychain'
import type { SecretStore } from '../ai/providers/secrets'
import { EncryptedFileStore } from '../main/safe-secrets'

/** macOS: Keychain via `security`. Windows/Linux: safeStorage (DPAPI, libsecret, KWallet) in an encrypted file.
 *  `fakeSecurity` (tests) forces the Keychain code path with a fake `security` binary on any OS. */
export function createSecretStore(userData: string, fakeSecurity?: string): SecretStore {
  if (fakeSecurity || process.platform === 'darwin') return new Keychain({ ...(fakeSecurity && { binary: fakeSecurity }) })
  return new EncryptedFileStore(join(userData, 'secrets.json'), {
    isAvailable: () => safeStorage.isEncryptionAvailable(),
    backend: () => (process.platform === 'linux' ? safeStorage.getSelectedStorageBackend() : 'os'),
    encrypt: (text) => safeStorage.encryptString(text),
    decrypt: (data) => safeStorage.decryptString(data),
  })
}
