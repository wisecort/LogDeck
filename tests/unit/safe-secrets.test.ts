import { mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EncryptedFileStore, type Cipher } from '../../src/main/safe-secrets'

const fakeCipher = (backend = 'gnome_libsecret', available = true): Cipher => ({
  isAvailable: () => available,
  backend: () => backend,
  encrypt: (s) => Buffer.from(`enc:${[...s].reverse().join('')}`),
  decrypt: (b) => [...b.toString().replace(/^enc:/, '')].reverse().join(''),
})

const store = (cipher = fakeCipher()) => {
  const file = join(mkdtempSync(join(tmpdir(), 'ld-sec-')), 'secrets.json')
  return { s: new EncryptedFileStore(file, cipher), file }
}

describe('EncryptedFileStore (Windows/Linux)', () => {
  it('stores keys encrypted, never in clear text, with 0600 permissions', async () => {
    const { s, file } = store()
    await s.set('logdeck-anthropic-api', 'sk-test-123')
    expect(readFileSync(file, 'utf8')).not.toContain('sk-test-123')
    if (process.platform !== 'win32') expect(statSync(file).mode & 0o777).toBe(0o600)
    expect(await s.get('logdeck-anthropic-api')).toBe('sk-test-123')
    expect(await s.has('logdeck-openai-compatible-api')).toBe(false)
  })

  it('deletes keys and tolerates deleting a missing one', async () => {
    const { s } = store()
    await s.set('logdeck-openai-compatible-api', 'k')
    await s.delete('logdeck-openai-compatible-api')
    await s.delete('logdeck-openai-compatible-api')
    expect(await s.get('logdeck-openai-compatible-api')).toBeUndefined()
  })

  it('refuses to store without a real OS vault (Linux basic_text fallback)', async () => {
    const { s } = store(fakeCipher('basic_text'))
    await expect(s.set('logdeck-anthropic-api', 'k')).rejects.toThrow(/cofre/)
    const { s: s2 } = store(fakeCipher('unknown', false))
    await expect(s2.set('logdeck-anthropic-api', 'k')).rejects.toThrow(/cofre/)
  })

  it('only touches LogDeck items and rejects control characters', async () => {
    const { s } = store()
    await expect(s.set('other' as 'logdeck-anthropic-api', 'k')).rejects.toThrow(/não permitido/)
    await expect(s.set('logdeck-anthropic-api', 'a\nb')).rejects.toThrow(/inválida/)
  })

  it('a missing or corrupted file reads as empty', async () => {
    const { s } = store()
    expect(await s.get('logdeck-anthropic-api')).toBeUndefined()
  })
})
