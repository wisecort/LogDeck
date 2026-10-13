import { describe, expect, it } from 'vitest'
import { friendlyError, kubectlEnv, timeoutMessage } from '../../src/k8s/kubectl'

describe('kubectlEnv', () => {
  it('adds Homebrew paths for apps opened from Finder', () => {
    const env = kubectlEnv({ PATH: '/usr/bin:/bin', HOME: '/Users/x' }, 'darwin')
    expect(env['PATH']!.split(':')).toEqual(['/usr/bin', '/bin', '/opt/homebrew/bin', '/usr/local/bin', '/Users/x/.local/bin'])
    expect(env['HOME']).toBe('/Users/x')
  })

  it('keeps an existing order and does not duplicate entries', () => {
    const env = kubectlEnv({ PATH: '/opt/homebrew/bin:/usr/bin', KUBECONFIG: '/a:/b', HOME: '/Users/x' }, 'darwin')
    expect(env['PATH']).toBe('/opt/homebrew/bin:/usr/bin:/usr/local/bin:/Users/x/.local/bin')
    expect(env['KUBECONFIG']).toBe('/a:/b')
  })

  it('works without PATH', () => {
    expect(kubectlEnv({ HOME: '/Users/x' }, 'darwin')['PATH']).toBe('/opt/homebrew/bin:/usr/local/bin:/Users/x/.local/bin')
  })

  it('uses the Linux and Windows dirs on those systems', () => {
    expect(kubectlEnv({ PATH: '/usr/bin', HOME: '/home/x' }, 'linux')['PATH']).toContain('/snap/bin')
    expect(kubectlEnv({ Path: 'C:\\Windows', USERPROFILE: 'C:\\Users\\x' }, 'win32')['Path']).toContain('WinGet')
  })
})

describe('friendlyError (F1.5)', () => {
  it('explains a missing kubectl', () => {
    const err = Object.assign(new Error('spawn kubectl ENOENT'), { code: 'ENOENT' })
    expect(friendlyError(err, 'darwin')).toContain('brew install kubectl')
    expect(friendlyError(err, 'win32')).toContain('winget install')
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

  it('names a missing login plugin instead of calling it a missing resource', () => {
    const stderr = [
      'E1013 10:00:00.000000   123 memcache.go:265] couldn\'t get current server API group list: Get "https://api.example.internal:6443/api": getting credentials: exec: executable aws not found',
      '',
      'It looks like you are trying to use a client-go credential plugin that is not installed.',
    ].join('\n')
    const pt = friendlyError(stderr)
    expect(pt).toContain('Plugin de login `aws` não encontrado')
    expect(pt).not.toContain('Recurso não encontrado')
    expect(friendlyError('getting credentials: exec: executable oc not found', 'darwin', 'en')).toContain('Login plugin `oc` not found')
    expect(friendlyError('exec: executable gke-gcloud-auth-plugin not found', 'darwin', 'es')).toContain('`gke-gcloud-auth-plugin`')
    expect(friendlyError('exec: executable kubelogin not found', 'darwin', 'pt-PT')).toContain('`kubelogin`')
  })

  it('falls back to the trimmed message', () => {
    expect(friendlyError('  something odd\n')).toBe('something odd')
    expect(friendlyError(new Error('boom'))).toBe('boom')
  })
})

describe('friendlyError in the interface language', () => {
  it('English and Spanish', () => {
    expect(friendlyError('error: You must be logged in to the server (Unauthorized)', 'darwin', 'en')).toContain('Session expired')
    expect(friendlyError('Error from server (Forbidden): x', 'darwin', 'es')).toContain('Sin permiso')
    const err = Object.assign(new Error('spawn kubectl ENOENT'), { code: 'ENOENT' })
    expect(friendlyError(err, 'linux', 'en')).toBe('kubectl not found. Install it with: sudo snap install kubectl --classic')
  })

  it('falls back to Portuguese for an unknown language', () => {
    expect(friendlyError('Error from server (Forbidden): x', 'darwin', 'xx')).toContain('Sem permissão')
  })
})

describe('timeoutMessage', () => {
  it('says what to check and which command hung, without the context name', () => {
    const msg = timeoutMessage(['get', 'pods', '-n', 'portal-hml', '-o', 'json', '--context=portal-prd/api:6443/dev'], 30_000, 'pt-BR')
    expect(msg).toBe('O cluster não respondeu em 30 s (kubectl get pods). Verifique a VPN/rede e se o login do contexto ainda vale (oc login, aws sso login…).')
    expect(timeoutMessage(['get', 'namespaces'], 30_000, 'en')).toContain('did not answer within 30 s (kubectl get namespaces)')
  })
})
