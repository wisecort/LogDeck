import { afterEach, describe, expect, it } from 'vitest'
import { anthropicMessage, DEFAULT_ANTHROPIC_MODEL } from '../../src/ai/providers/anthropic'
import { fakeAnthropicServer } from '../helpers/fake-ai'

let close: (() => Promise<void>) | undefined
afterEach(async () => {
  await close?.()
  close = undefined
})

describe('Anthropic API provider (official SDK)', () => {
  it('defaults to claude-opus-5-5', () => {
    expect(DEFAULT_ANTHROPIC_MODEL).toBe('claude-opus-5-5')
  })

  it('sends system + user with effort medium and server-side fallbacks', async () => {
    const srv = await fakeAnthropicServer()
    close = srv.close
    const text = await anthropicMessage({ apiKey: 'k-test', baseURL: srv.baseUrl }, 'SYS', 'USER')
    expect(text).toBe('## Causa provável\nOK Anthropic')
    const [req] = srv.requests
    expect(req!.path).toMatch(/^\/v1\/messages/)
    expect(req!.apiKey).toBe('k-test')
    expect(req!.beta).toContain('server-side-fallback-2026-07-01')
    expect(req!.body).toMatchObject({
      model: 'claude-opus-5-5',
      system: 'SYS',
      messages: [{ role: 'user', content: 'USER' }],
      output_config: { effort: 'medium' },
      fallbacks: 'default',
    })
  })

  it('uses the configured model', async () => {
    const srv = await fakeAnthropicServer()
    close = srv.close
    await anthropicMessage({ apiKey: 'k', baseURL: srv.baseUrl, model: 'claude-haiku-5-5' }, 'S', 'U')
    expect(srv.requests[0]!.body.model).toBe('claude-haiku-5-5')
  })

  it('explains an invalid key', async () => {
    const srv = await fakeAnthropicServer('unauthorized')
    close = srv.close
    await expect(anthropicMessage({ apiKey: 'bad', baseURL: srv.baseUrl }, 'S', 'U')).rejects.toThrow(/chave.*inválida/i)
  })

  it('reports a refusal instead of an empty answer', async () => {
    const srv = await fakeAnthropicServer('refusal')
    close = srv.close
    await expect(anthropicMessage({ apiKey: 'k', baseURL: srv.baseUrl }, 'S', 'U')).rejects.toThrow(/recus/i)
  })

  it('aborts on timeout', async () => {
    const srv = await fakeAnthropicServer('slow')
    close = srv.close
    await expect(anthropicMessage({ apiKey: 'k', baseURL: srv.baseUrl }, 'S', 'U', { timeoutMs: 300 })).rejects.toThrow(/tempo esgotado/i)
  })

  it('requires a key and a valid model name', async () => {
    await expect(anthropicMessage({ apiKey: '' }, 'S', 'U')).rejects.toThrow(/chave/i)
    await expect(anthropicMessage({ apiKey: 'k', model: 'x; rm -rf /' }, 'S', 'U')).rejects.toThrow(/modelo/i)
  })
})
