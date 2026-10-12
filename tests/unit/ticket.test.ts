import { describe, expect, it } from 'vitest'
import { entry } from '../helpers/entries'
import { ticketText } from '../../src/ui/ticket'

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
