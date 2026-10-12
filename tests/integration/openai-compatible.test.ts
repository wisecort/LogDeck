import { afterEach, describe, expect, it } from 'vitest'
import { chatCompletion, destinationOf, OPENAI_PRESETS, validateBaseUrl } from '../../src/ai/providers/openai-compatible'
import { fakeChatServer } from '../helpers/fake-ai'

let close: (() => Promise<void>) | undefined
afterEach(async () => {
  await close?.()
  close = undefined
})

describe('OpenAI-compatible provider (F7.0)', () => {
  it('posts system + user messages to {base}/chat/completions with the key as Bearer', async () => {
    const srv = await fakeChatServer()
    close = srv.close
    const text = await chatCompletion({ baseUrl: srv.baseUrl, model: 'llama3.1', apiKey: 'k-123' }, 'SYS', 'USER')
    expect(text).toBe('## Causa provável\nOK local')
    expect(srv.requests[0]).toMatchObject({
      path: '/v1/chat/completions',
      authorization: 'Bearer k-123',
      body: { model: 'llama3.1', messages: [{ role: 'system', content: 'SYS' }, { role: 'user', content: 'USER' }] },
    })
  })

  it('sends no Authorization header without a key (Ollama)', async () => {
    const srv = await fakeChatServer()
    close = srv.close
    await chatCompletion({ baseUrl: srv.baseUrl, model: 'm' }, 'S', 'U')
    expect(srv.requests[0]!.authorization).toBeUndefined()
  })

  it('explains HTTP 401', async () => {
    const srv = await fakeChatServer('unauthorized')
    close = srv.close
    await expect(chatCompletion({ baseUrl: srv.baseUrl, model: 'm', apiKey: 'x' }, 'S', 'U')).rejects.toThrow(/chave.*401/i)
  })

  it('rejects an unexpected response shape', async () => {
    const srv = await fakeChatServer('bad-json')
    close = srv.close
    await expect(chatCompletion({ baseUrl: srv.baseUrl, model: 'm' }, 'S', 'U')).rejects.toThrow(/resposta inesperada/i)
  })

  it('aborts on timeout', async () => {
    const srv = await fakeChatServer('slow')
    close = srv.close
    await expect(chatCompletion({ baseUrl: srv.baseUrl, model: 'm' }, 'S', 'U', { timeoutMs: 200 })).rejects.toThrow(/tempo esgotado/i)
  })

  it('reports an unreachable server', async () => {
    await expect(chatCompletion({ baseUrl: 'http://127.0.0.1:9/v1', model: 'm' }, 'S', 'U')).rejects.toThrow(/conectar/i)
  })
})

describe('validateBaseUrl (G6)', () => {
  it.each(['https://api.deepseek.com', 'https://openrouter.ai/api/v1/', 'http://localhost:11434/v1', 'http://127.0.0.1:1234/v1'])('accepts %s', (url) => {
    expect(validateBaseUrl(url)).toBe(url.replace(/\/$/, ''))
  })

  it.each(['http://api.deepseek.com', 'ftp://x', 'https://user:pw@api.example.internal', 'not a url', '', 'http://10.0.0.5:11434'])('rejects %s', (url) => {
    expect(() => validateBaseUrl(url)).toThrow()
  })
})

describe('destinationOf (F7.2)', () => {
  it('labels local and remote destinations', () => {
    expect(destinationOf('http://localhost:11434/v1')).toEqual({ label: 'Local · localhost:11434 (não sai da máquina)', local: true })
    expect(destinationOf('https://api.deepseek.com')).toEqual({ label: 'api.deepseek.com', local: false })
  })

  it('ships presets for local and hosted providers', () => {
    expect(OPENAI_PRESETS.map((p) => p.id)).toEqual(['ollama', 'lmstudio', 'deepseek', 'openrouter', 'groq', 'custom'])
    for (const p of OPENAI_PRESETS.filter((x) => x.baseUrl)) expect(() => validateBaseUrl(p.baseUrl)).not.toThrow()
  })
})
