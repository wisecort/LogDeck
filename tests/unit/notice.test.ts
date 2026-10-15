import { describe, expect, it } from 'vitest'
import { friendlyError, timeoutMessage } from '../../src/k8s/kubectl'
import { noticeFromError, noticeTone } from '../../src/ui/notice'

describe('noticeFromError', () => {
  it.each([
    ['error: You must be logged in to the server (Unauthorized)', 'auth'],
    ['Error from server (Forbidden): pods is forbidden', 'forbidden'],
    ['Unable to connect to the server: dial tcp: lookup api.example.internal: no such host', 'unreachable'],
    ['Error from server (NotFound): pods "x" not found', 'notFound'],
    ['error: context "x" does not exist', 'noContext'],
    ['exec: executable kubelogin not found', 'plugin'],
  ] as const)('recognizes the %s message as %s in every language', (stderr, kind) => {
    for (const lang of ['pt-BR', 'pt-PT', 'en', 'es']) {
      const text = friendlyError(stderr, 'darwin', lang)
      expect(noticeFromError(text)).toEqual({ kind, text })
    }
  })

  it('recognizes timeouts and a missing kubectl', () => {
    const timeout = timeoutMessage(['get', 'pods', '-n', 'x'], 30_000, 'en')
    expect(noticeFromError(timeout).kind).toBe('timeout')
    const missing = friendlyError(Object.assign(new Error('spawn kubectl ENOENT'), { code: 'ENOENT' }), 'darwin', 'es')
    expect(noticeFromError(missing).kind).toBe('missing')
  })

  it('anything else is a generic error with the text untouched', () => {
    expect(noticeFromError('boom')).toEqual({ kind: 'error', text: 'boom' })
  })
})

describe('noticeTone', () => {
  it('cluster errors are red, app warnings are amber', () => {
    expect(noticeTone('unreachable')).toBe('error')
    expect(noticeTone('error')).toBe('error')
    expect(noticeTone('tabsLimit')).toBe('warn')
    expect(noticeTone('recentGone')).toBe('warn')
    expect(noticeTone('noContexts')).toBe('warn')
  })
})
