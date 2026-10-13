import { describe, expect, it } from 'vitest'
import { entry } from '../helpers/entries'
import { lineText, ticketText } from '../../src/ui/ticket'

const where = { context: 'portal-hml/api-hml-example-internal:6443/dev', namespace: 'portal-hml', pod: 'portal-web-7d9f8c6b5-x2k4p', container: 'httpd' }
const T = Date.parse('2026-10-09T03:24:05.123Z')

describe('ticketText', () => {
  it('has where, when (UTC, both clocks), level and the line', () => {
    const e = entry({ raw: 'AH01075: Error dispatching request to : (polling)', level: 'ERROR', k8sTime: T, logTime: T - 3 * 3600_000 })
    const text = ticketText(e, where)
    expect(text).toContain('Pod: portal-hml / portal-web-7d9f8c6b5-x2k4p / httpd')
    expect(text).toContain('Contexto: portal-hml/api-hml-example-internal:6443/dev')
    expect(text).toContain('Horário (kubectl): 2026-10-09 03:24:05.123 UTC')
    expect(text).toContain('Horário (log): 2026-10-09 00:24:05.123 UTC')
    expect(text).toContain('Nível: ERROR')
    expect(text).toMatch(/```\nAH01075: Error dispatching request to : \(polling\)\n```/)
  })

  it('includes the stack trace and masks secrets, keeping IPs', () => {
    const e = entry({ raw: 'login failed password=hunter2 from 10.0.0.5', continuation: ['  at a()', '  at b()'] })
    const text = ticketText(e, where)
    expect(text).not.toContain('hunter2')
    expect(text).toContain('[REDACTED:PASSWORD]')
    expect(text).toContain('10.0.0.5')
    expect(text).toContain('  at a()\n  at b()')
  })

  it('names the file when the log came from a local file', () => {
    const text = ticketText(entry({ raw: 'x' }), { file: 'pod-php-apache.log' })
    expect(text).toContain('Arquivo: pod-php-apache.log')
    expect(text).not.toContain('Pod:')
  })
})

describe('lineText (Details → Copy)', () => {
  const e = entry({
    raw: '[proxy_fcgi:error] [client 10.0.0.2:48660] AH01075 token=abc123def user=ana@example.com',
    continuation: ['  at db 192.168.1.20 password=hunter2'],
  })

  it('copies the line and its stack trace as they are by default', () => {
    expect(lineText(e)).toBe([e.raw, ...e.continuation].join('\n'))
  })

  it('masks secrets and internal IPs when asked', () => {
    const text = lineText(e, { mask: true })
    expect(text).toContain('[client [REDACTED:IP]:48660]')
    expect(text).toContain('token=[REDACTED:SECRET]')
    expect(text).toContain('[REDACTED:EMAIL]')
    expect(text).toContain('at db [REDACTED:IP] password=[REDACTED:PASSWORD]')
    expect(text).not.toMatch(/10\.0\.0\.2|192\.168|hunter2|abc123def|ana@/)
  })

  it('keeps public IPs (only RFC 1918 addresses are masked)', () => {
    expect(lineText(entry({ raw: 'GET / from 203.0.113.7' }), { mask: true })).toContain('203.0.113.7')
  })
})
