// Claude Code CLI as an AI provider (F7.0, ADR 0002). It is an agent, so every tool is disabled,
// nothing is persisted, the payload goes through stdin and the cwd is an empty temp dir.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MODEL_RE } from '../../shared/ai-settings'
import { ProcessTimeoutError, runProcess } from './process'

const DEFAULT_TIMEOUT_MS = 120_000

export interface ClaudeOptions {
  binary?: string
  env?: NodeJS.ProcessEnv
  timeoutMs?: number
  model?: string
}

export function buildClaudeArgs(systemPrompt: string, model?: string): string[] {
  if (model !== undefined && !MODEL_RE.test(model)) throw new Error('modelo inválido para o Claude Code CLI')
  return [
    '-p',
    '--output-format',
    'json',
    '--tools',
    '',
    '--no-session-persistence',
    '--strict-mcp-config',
    '--disable-slash-commands',
    '--permission-mode',
    'dontAsk',
    '--system-prompt',
    systemPrompt,
    ...(model ? ['--model', model] : []),
  ]
}

/** Final gate: only the hardened argv may reach spawn (G2, G6). */
export function assertClaudeArgs(argv: readonly string[]): void {
  const system = argv[11]
  const model = argv.length === 14 && argv[12] === '--model' ? argv[13] : undefined
  if (system === undefined || (argv.length !== 12 && model === undefined)) throw new Error('argv do Claude Code CLI fora do formato permitido')
  const expected = buildClaudeArgs(system, model)
  if (expected.length !== argv.length || expected.some((a, i) => a !== argv[i])) {
    throw new Error('argv do Claude Code CLI fora do formato permitido')
  }
}

export async function detectClaude(opts: ClaudeOptions = {}): Promise<{ installed: boolean; version?: string; message?: string }> {
  try {
    const r = await runProcess(opts.binary ?? 'claude', ['--version'], { ...(opts.env && { env: opts.env }), timeoutMs: 15_000 })
    if (r.code !== 0) return { installed: false, message: r.stderr.trim() || 'claude --version falhou' }
    return { installed: true, version: r.stdout.trim() }
  } catch {
    return { installed: false, message: 'Claude Code CLI não encontrado no PATH' }
  }
}

export async function runClaude(system: string, user: string, opts: ClaudeOptions = {}): Promise<string> {
  const args = buildClaudeArgs(system, opts.model || undefined)
  assertClaudeArgs(args)
  const cwd = mkdtempSync(join(tmpdir(), 'logdeck-claude-'))
  let r
  try {
    r = await runProcess(opts.binary ?? 'claude', args, {
      ...(opts.env && { env: opts.env }),
      cwd,
      input: user,
      timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    })
  } catch (err) {
    if (err instanceof ProcessTimeoutError) throw new Error('Claude Code CLI: tempo esgotado', { cause: err })
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('Claude Code CLI não encontrado no PATH', { cause: err })
    throw err
  } finally {
    // On Windows a just-killed process may still hold its cwd for a moment: retry, and never let the
    // cleanup hide the real error (e.g. the timeout).
    try {
      rmSync(cwd, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
    } catch {
      // an empty temp dir left behind is harmless
    }
  }

  let parsed: { is_error?: boolean; result?: unknown }
  try {
    parsed = JSON.parse(r.stdout.trim()) as typeof parsed
  } catch (err) {
    throw new Error(`Claude Code CLI: resposta inesperada${r.stderr.trim() ? ` (${r.stderr.trim().split('\n')[0]})` : ''}`, { cause: err })
  }
  const result = typeof parsed.result === 'string' ? parsed.result : ''
  if (parsed.is_error || r.code !== 0) {
    if (/log ?in/i.test(result)) throw new Error('Claude Code CLI sem login: rode `claude` no terminal e faça /login')
    throw new Error(`Claude Code CLI: ${result || r.stderr.trim() || `código ${r.code}`}`)
  }
  if (!result) throw new Error('Claude Code CLI: resposta inesperada (vazia)')
  return result
}
