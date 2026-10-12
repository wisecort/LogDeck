import { describe, expect, it } from 'vitest'
import { stripAnsi } from '../../src/logs/ansi'
import { LogAssembler } from '../../src/logs/classify'

describe('stripAnsi (F3.6)', () => {
  it.each([
    ['\u001b[31mERROR\u001b[0m boom', 'ERROR boom'],
    ['\u001b[1;33mwarn\u001b[39;22m x', 'warn x'],
    ['\u001b]0;title\u0007text', 'text'],
    ['\u001b[2K\u001b[1Gprogress', 'progress'],
    ['plain', 'plain'],
  ])('%j → %j', (input, expected) => {
    expect(stripAnsi(input)).toBe(expected)
  })

  it('is applied before parsing so colored lines still get a level', () => {
    const r = new LogAssembler({ now: () => 0 }).push('2026-10-09T03:26:40Z \u001b[31m[2026-10-09 03:26:40] production.ERROR: boom\u001b[0m')
    expect(r).toMatchObject({ type: 'entry', entry: { level: 'ERROR', parser: 'laravel', raw: '[2026-10-09 03:26:40] production.ERROR: boom' } })
  })
})
