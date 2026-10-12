import { describe, expect, it } from 'vitest'
import { friendlyError, kubectlEnv } from '../../src/k8s/kubectl'

describe('kubectlEnv', () => {
  it('adds Homebrew paths for apps opened from Finder', () => {
    const env = kubectlEnv({ PATH: '/usr/bin:/bin', HOME: '/Users/x' })
    expect(env['PATH']!.split(':')).toEqual(['/usr/bin', '/bin', '/opt/homebrew/bin', '/usr/local/bin'])
    expect(env['HOME']).toBe('/Users/x')
  })

  it('keeps an existing order and does not duplicate entries', () => {
    const env = kubectlEnv({ PATH: '/opt/homebrew/bin:/usr/bin', KUBECONFIG: '/a:/b' })
    expect(env['PATH']).toBe('/opt/homebrew/bin:/usr/bin:/usr/local/bin')
    expect(env['KUBECONFIG']).toBe('/a:/b')
  })

  it('works without PATH', () => {
    expect(kubectlEnv({})['PATH']).toBe('/opt/homebrew/bin:/usr/local/bin')
  })
})

describe('friendlyError (F1.5)', () => {
  it('explains a missing kubectl', () => {
    const err = Object.assign(new Error('spawn kubectl ENOENT'), { code: 'ENOENT' })
    expect(friendlyError(err)).toContain('brew install kubectl')
  })

  it.each([
    ['error: You must be logged in to the server (Unauthorized)', 'oc login'],
    ['Error from server (Forbidden): pods is forbidden: User "dev" cannot list resource "pods"', 'Sem permissão'],
    ['Unable to connect to the server: dial tcp: lookup api-hml.example.internal: no such host', 'Cluster inacessível'],
    ['Unable to connect to the server: net/http: TLS handshake timeout', 'Cluster inacessível'],
    ['Error from server (NotFound): pods "x" not found', 'não encontrado'],
    ['error: context "x" does not exist', 'Contexto'],
  ])('%s', (stderr, expected) => {
    expect(friendlyError(stderr)).toContain(expected)
  })

  it('falls back to the trimmed message', () => {
    expect(friendlyError('  something odd\n')).toBe('something odd')
    expect(friendlyError(new Error('boom'))).toBe('boom')
  })
})
