import { describe, expect, it } from 'vitest'
import { assertClaudeArgs, buildClaudeArgs, detectClaude, runClaude } from '../../src/ai/providers/claude-cli'
import { fakeClaudeEnv } from '../helpers/fake-ai'

describe('Claude Code CLI provider (F7.0)', () => {
  it('detects the installed version', async () => {
    const fake = fakeClaudeEnv()
    await expect(detectClaude({ env: fake.env })).resolves.toEqual({ installed: true, version: '2.1.296 (Claude Code)' })
    await expect(detectClaude({ env: fake.env, binary: 'claude-not-installed-xyz' })).resolves.toMatchObject({ installed: false })
  })

  it('runs with tools disabled, no session persistence, payload on stdin and an empty temp cwd', async () => {
    const fake = fakeClaudeEnv()
    const text = await runClaude('SYSTEM', 'USER <logs>x</logs>', { env: fake.env })
    expect(text).toContain('## Causa provável')
    const [call] = fake.calls()
    expect(call!.stdin).toBe('USER <logs>x</logs>')
    expect(call!.argv).not.toContain('USER <logs>x</logs>')
    expect(call!.argv[call!.argv.indexOf('--tools') + 1]).toBe('')
    expect(call!.argv).toContain('--no-session-persistence')
    expect(call!.cwdEntries).toBe(0)
    expect(call!.cwd).not.toBe(process.cwd())
  })

  it('reports a not-logged-in CLI with an actionable message', async () => {
    await expect(runClaude('S', 'U', { env: fakeClaudeEnv('not-logged-in').env })).rejects.toThrow(/claude.*login|login.*claude/i)
  })

  it('rejects output that is not the expected JSON', async () => {
    await expect(runClaude('S', 'U', { env: fakeClaudeEnv('garbage').env })).rejects.toThrow(/resposta inesperada/i)
  })

  it('kills the CLI on timeout', async () => {
    const t0 = Date.now()
    await expect(runClaude('S', 'U', { env: fakeClaudeEnv('slow').env, timeoutMs: 300 })).rejects.toThrow(/tempo esgotado/i)
    expect(Date.now() - t0).toBeLessThan(3000)
  })

  it('only accepts the hardened argv (G2, G6)', () => {
    expect(() => assertClaudeArgs(buildClaudeArgs('S'))).not.toThrow()
    expect(() => assertClaudeArgs(buildClaudeArgs('S', 'claude-sonnet-5-5'))).not.toThrow()
    expect(() => assertClaudeArgs([...buildClaudeArgs('S'), '--permission-mode', 'acceptEdits'])).toThrow()
    expect(() => assertClaudeArgs(buildClaudeArgs('S').map((a) => (a === '' ? 'Bash' : a)))).toThrow()
    expect(() => buildClaudeArgs('S', 'bad model; rm')).toThrow()
  })
})
