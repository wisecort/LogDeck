import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AiSettingsStore } from '../../src/main/ai-settings-store'
import { DEFAULT_AI_SETTINGS, sanitizeAiSettings } from '../../src/shared/ai-settings'

describe('AI settings', () => {
  it('defaults to no provider, Opus 5.5 for the API and IP masking off', () => {
    expect(DEFAULT_AI_SETTINGS).toMatchObject({ provider: 'none', anthropicModel: 'claude-opus-5-5', maskInternalIps: false })
  })

  it('sanitizes untrusted input', () => {
    const s = sanitizeAiSettings({
      provider: 'evil',
      anthropicModel: 'x; rm -rf /',
      openai: { preset: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' },
      maskInternalIps: 'yes',
    })
    expect(s.provider).toBe('none')
    expect(s.anthropicModel).toBe('claude-opus-5-5')
    expect(s.openai).toEqual({ preset: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' })
    expect(s.maskInternalIps).toBe(false)
    expect(sanitizeAiSettings({ provider: 'anthropic', anthropicModel: 'claude-haiku-5-5' })).toMatchObject({
      provider: 'anthropic',
      anthropicModel: 'claude-haiku-5-5',
    })
    expect(sanitizeAiSettings({ openai: { model: 'meta-llama/llama-3.1-8b-instruct:free' } }).openai.model).toBe('meta-llama/llama-3.1-8b-instruct:free')
  })

  it('persists across restarts and survives a corrupt file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'logdeck-ai-'))
    const file = join(dir, 'ai.json')
    new AiSettingsStore(file).set({ provider: 'claude-cli', maskInternalIps: true })
    expect(new AiSettingsStore(file).get()).toMatchObject({ provider: 'claude-cli', maskInternalIps: true })
    writeFileSync(file, '{oops')
    expect(new AiSettingsStore(file).get()).toEqual(DEFAULT_AI_SETTINGS)
  })
})
