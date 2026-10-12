import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FAKE_BIN } from './fake-kubectl'
import { withPathFirst } from './path'

export interface ClaudeCall {
  argv: string[]
  stdin: string
  cwd: string
  cwdEntries: number
}

export function fakeClaudeEnv(mode = 'ok') {
  const log = join(mkdtempSync(join(tmpdir(), 'logdeck-fake-claude-')), 'calls.jsonl')
  const env = { ...withPathFirst(process.env, FAKE_BIN), FAKE_CLAUDE_LOG: log, FAKE_CLAUDE_MODE: mode }
  const calls = (): ClaudeCall[] =>
    existsSync(log)
      ? readFileSync(log, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((l) => JSON.parse(l) as ClaudeCall)
      : []
  return { env, calls }
}

export interface FakeChatRequest {
  path: string
  authorization?: string
  body: { model: string; messages: Array<{ role: string; content: string }> }
}

/** Minimal Chat Completions server on 127.0.0.1 (OpenAI-compatible). */
export async function fakeChatServer(behaviour: 'ok' | 'unauthorized' | 'slow' | 'bad-json' = 'ok') {
  const requests: FakeChatRequest[] = []
  const server: Server = createServer((req: IncomingMessage, res) => {
    let raw = ''
    req.on('data', (d) => (raw += d))
    req.on('end', () => {
      requests.push({ path: req.url ?? '', authorization: req.headers.authorization, body: JSON.parse(raw || '{}') })
      if (behaviour === 'slow') return
      if (behaviour === 'unauthorized') {
        res.writeHead(401, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: { message: 'Invalid API key' } }))
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(behaviour === 'bad-json' ? '{"choices": []}' : JSON.stringify({ choices: [{ message: { role: 'assistant', content: '## Causa provável\nOK local' } }] }))
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address() as AddressInfo
  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    requests,
    close: () => new Promise<void>((r) => server.close(() => r())),
  }
}

export function fakeSecurity() {
  const dir = mkdtempSync(join(tmpdir(), 'logdeck-fake-security-'))
  const store = join(dir, 'store.json')
  const log = join(dir, 'argv.jsonl')
  const env = { ...withPathFirst(process.env, FAKE_BIN), FAKE_SECURITY_STORE: store, FAKE_SECURITY_LOG: log }
  return {
    env,
    binary: join(FAKE_BIN, process.platform === 'win32' ? 'security.exe' : 'security'),
    calls: (): string[][] =>
      existsSync(log)
        ? readFileSync(log, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map((l) => JSON.parse(l) as string[])
        : [],
  }
}

export interface FakeAnthropicRequest {
  path: string
  apiKey?: string
  beta?: string
  body: {
    model: string
    system?: string
    max_tokens: number
    messages: Array<{ role: string; content: string }>
    output_config?: { effort?: string }
    fallbacks?: unknown
  }
}

/** Minimal Anthropic Messages API on 127.0.0.1 for the official SDK (baseURL override). */
export async function fakeAnthropicServer(behaviour: 'ok' | 'unauthorized' | 'refusal' | 'slow' = 'ok') {
  const requests: FakeAnthropicRequest[] = []
  const server: Server = createServer((req, res) => {
    let raw = ''
    req.on('data', (d) => (raw += d))
    req.on('end', () => {
      requests.push({
        path: req.url ?? '',
        apiKey: req.headers['x-api-key'] as string | undefined,
        beta: req.headers['anthropic-beta'] as string | undefined,
        body: JSON.parse(raw || '{}'),
      })
      if (behaviour === 'slow') return
      if (behaviour === 'unauthorized') {
        res.writeHead(401, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }))
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(
        JSON.stringify({
          id: 'msg_fake',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-5-5',
          content: behaviour === 'refusal' ? [] : [{ type: 'text', text: '## Causa provável\nOK Anthropic' }],
          stop_reason: behaviour === 'refusal' ? 'refusal' : 'end_turn',
          stop_sequence: null,
          ...(behaviour === 'refusal' && { stop_details: { type: 'refusal', category: null, explanation: 'declined' } }),
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      )
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address() as AddressInfo
  return { baseUrl: `http://127.0.0.1:${port}`, requests, close: () => new Promise<void>((r) => server.close(() => r())) }
}
