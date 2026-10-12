import { describe, expect, it } from 'vitest'
import { Keychain, KEY_SERVICES } from '../../src/ai/providers/keychain'
import { fakeSecurity } from '../helpers/fake-ai'

describe('Keychain (macOS security CLI)', () => {
  it('stores, reads and deletes a key per service', async () => {
    const fake = fakeSecurity()
    const kc = new Keychain({ binary: fake.binary, env: fake.env, account: 'tester' })
    await expect(kc.get('logdeck-anthropic-api')).resolves.toBeUndefined()
    await kc.set('logdeck-anthropic-api', 'k-123')
    await expect(kc.get('logdeck-anthropic-api')).resolves.toBe('k-123')
    await expect(kc.has('logdeck-anthropic-api')).resolves.toBe(true)
    await kc.delete('logdeck-anthropic-api')
    await expect(kc.has('logdeck-anthropic-api')).resolves.toBe(false)
    await expect(kc.delete('logdeck-anthropic-api')).resolves.toBeUndefined()
  })

  it('only touches LogDeck services', async () => {
    const fake = fakeSecurity()
    const kc = new Keychain({ binary: fake.binary, env: fake.env, account: 'tester' })
    expect(KEY_SERVICES).toEqual(['logdeck-anthropic-api', 'logdeck-openai-compatible-api'])
    await expect(kc.get('com.apple.something' as never)).rejects.toThrow()
    expect(fake.calls()).toEqual([])
  })

  it('rejects empty or multi-line keys', async () => {
    const fake = fakeSecurity()
    const kc = new Keychain({ binary: fake.binary, env: fake.env, account: 'tester' })
    await expect(kc.set('logdeck-anthropic-api', '')).rejects.toThrow()
    await expect(kc.set('logdeck-anthropic-api', 'a\nb')).rejects.toThrow()
  })
})
