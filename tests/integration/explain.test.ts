import { afterEach, describe, expect, it } from 'vitest'
import { ExplainService, type AiProvider } from '../../src/ai/explain'
import { SYSTEM_PROMPT } from '../../src/ai/prompt'
import { createProvider } from '../../src/ai/providers'
import { Keychain } from '../../src/ai/providers/keychain'
import { DEFAULT_AI_SETTINGS } from '../../src/shared/ai-settings'
import { fakeAnthropicServer, fakeChatServer, fakeClaudeEnv, fakeSecurity } from '../helpers/fake-ai'

const PW = 'pass' + 'word=hunter2'
const GROUPS = [
  {
    title: 'Timeout Apache → PHP-FPM',
    count: 2,
    lines: [
      '[proxy_fcgi:error] (70007)The timeout specified has expired: [client 10.0.0.2:48660] AH01075',
      `[proxy_fcgi:error] AH01075 login ${PW}`,
    ],
  },
]

function recordingProvider(answer = '## Causa provável\nx\n```bash\nkubectl delete pod y\n```') {
  const calls: Array<{ system: string; user: string }> = []
  const provider: AiProvider = {
    destination: 'Teste · fake',
    local: false,
    complete: async (system, user) => {
      calls.push({ system, user })
      return answer
    },
  }
  return { provider, calls }
}

describe('ExplainService (F7.1–F7.5, G6)', () => {
  it('requires a configured provider', async () => {
    const svc = new ExplainService({ provider: async () => undefined })
    await expect(svc.preview(GROUPS, {})).rejects.toThrow(/Configure um provedor/)
  })

  it('previews the masked payload with its destination', async () => {
    const { provider } = recordingProvider()
    const p = await new ExplainService({ provider: async () => provider }).preview(GROUPS, {})
    expect(p.text).toContain('Timeout Apache → PHP-FPM')
    expect(p.text).not.toContain('hunter2')
    expect(p.text).toContain('[REDACTED:PASSWORD]')
    expect(p.text).toContain('10.0.0.2')
    expect(p).toMatchObject({ lines: 2, truncated: false, redactions: 1, destination: 'Teste · fake', local: false })
    expect(p.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('masks internal IPs when asked', async () => {
    const { provider } = recordingProvider()
    const p = await new ExplainService({ provider: async () => provider }).preview(GROUPS, { maskInternalIps: true })
    expect(p.text).not.toContain('10.0.0.2')
  })

  it('sends exactly the previewed text, once, inside <logs>', async () => {
    const { provider, calls } = recordingProvider()
    const svc = new ExplainService({ provider: async () => provider })
    const p = await svc.preview(GROUPS, {})
    const r = await svc.explain(p.id)
    expect(calls).toHaveLength(1)
    expect(calls[0]!.system).toBe(SYSTEM_PROMPT)
    expect(calls[0]!.user).toContain(`<logs>\n${p.text}\n</logs>`)
    expect(r.writeCommands).toEqual(['kubectl delete pod y'])
    expect(r.blocks.map((b) => b.type)).toEqual(['text', 'code'])
    await expect(svc.explain(p.id)).rejects.toThrow(/expirado ou já enviado/)
    await expect(svc.explain('nope')).rejects.toThrow(/expirado ou já enviado/)
  })

  it('expires previews', async () => {
    let now = 0
    const { provider } = recordingProvider()
    const svc = new ExplainService({ provider: async () => provider, now: () => now, ttlMs: 1000 })
    const p = await svc.preview(GROUPS, {})
    now = 2000
    await expect(svc.explain(p.id)).rejects.toThrow(/expirado/)
  })

  it('validates and caps the groups coming from the renderer', async () => {
    const { provider } = recordingProvider()
    const svc = new ExplainService({ provider: async () => provider })
    await expect(svc.preview('x', {})).rejects.toThrow()
    await expect(svc.preview([{ title: 1, count: 1, lines: [] }], {})).rejects.toThrow()
    const big = await svc.preview([{ title: 'A', count: 5000, lines: Array.from({ length: 5000 }, (_, i) => `l${i} ${'x'.repeat(9000)}`) }], {})
    expect(big.truncated).toBe(true)
    expect(big.bytes).toBeLessThanOrEqual(32 * 1024)
    await expect(svc.preview([], {})).rejects.toThrow(/selecione/i)
  })

  it('tests the provider with a fixed prompt and no logs', async () => {
    const { provider, calls } = recordingProvider('OK')
    await expect(new ExplainService({ provider: async () => provider }).test()).resolves.toBe('OK')
    expect(calls[0]!.user).toBe('Responda apenas OK')
    expect(calls[0]!.user).not.toContain('<logs>')
  })
})

describe('createProvider', () => {
  let close: (() => Promise<void>) | undefined
  afterEach(async () => {
    await close?.()
    close = undefined
  })

  it('returns undefined for "none"', async () => {
    const sec = fakeSecurity()
    const kc = new Keychain({ binary: sec.binary, env: sec.env, account: 't' })
    await expect(createProvider(DEFAULT_AI_SETTINGS, { keychain: kc })).resolves.toBeUndefined()
  })

  it('builds the Claude Code CLI provider', async () => {
    const sec = fakeSecurity()
    const claude = fakeClaudeEnv()
    const p = await createProvider({ ...DEFAULT_AI_SETTINGS, provider: 'claude-cli' }, { keychain: new Keychain({ binary: sec.binary, env: sec.env, account: 't' }), env: claude.env })
    expect(p).toMatchObject({ destination: 'Claude Code CLI · sua conta Anthropic', local: false })
    expect(await p!.complete('S', 'U')).toContain('Causa provável')
  })

  it('builds the Anthropic provider from the key in the Keychain', async () => {
    const sec = fakeSecurity()
    const kc = new Keychain({ binary: sec.binary, env: sec.env, account: 't' })
    const settings = { ...DEFAULT_AI_SETTINGS, provider: 'anthropic' as const }
    await expect(createProvider(settings, { keychain: kc })).rejects.toThrow(/chave/i)
    await kc.set('logdeck-anthropic-api', 'k-anthropic')
    const srv = await fakeAnthropicServer()
    close = srv.close
    const p = await createProvider(settings, { keychain: kc, anthropicBaseURL: srv.baseUrl })
    expect(p).toMatchObject({ destination: 'API da Anthropic · api.anthropic.com', local: false })
    expect(await p!.complete('S', 'U')).toContain('OK Anthropic')
    expect(srv.requests[0]!.apiKey).toBe('k-anthropic')
  })

  it('builds the OpenAI-compatible provider (local, no key)', async () => {
    const sec = fakeSecurity()
    const srv = await fakeChatServer()
    close = srv.close
    const p = await createProvider(
      { ...DEFAULT_AI_SETTINGS, provider: 'openai', openai: { preset: 'custom', baseUrl: srv.baseUrl, model: 'm' } },
      { keychain: new Keychain({ binary: sec.binary, env: sec.env, account: 't' }) },
    )
    expect(p!.local).toBe(true)
    expect(p!.destination).toMatch(/^Local · 127\.0\.0\.1/)
    expect(await p!.complete('S', 'U')).toContain('OK local')
  })
})
