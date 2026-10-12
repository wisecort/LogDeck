import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { isProductionContext, listContexts, parseGetContexts } from '../../src/k8s/contexts'
import { FIXTURES } from '../helpers/fake-kubectl'

const TABLE = readFileSync(join(FIXTURES, 'kubectl/get-contexts.txt'), 'utf8')
const KUBECONFIG = readFileSync(join(FIXTURES, 'kubectl/kubeconfig.fake.yaml'), 'utf8')

/** Credential values present in the fake kubeconfig. None may leak. */
const SECRETS = [...KUBECONFIG.matchAll(/(?:token|client-key-data|client-certificate-data|certificate-authority-data):\s*(\S+)/g)].map(
  (m) => m[1]!,
)

describe('parseGetContexts', () => {
  it('lists every context with cluster, namespace and current marker (F1.1)', () => {
    expect(parseGetContexts(TABLE)).toEqual([
      {
        name: 'portal-hml/api-hml-example-internal:6443/dev',
        cluster: 'api-hml-example-internal:6443',
        namespace: 'portal-hml',
        current: true,
        production: false,
      },
      {
        name: 'portal-prd/api-prd-example-internal:6443/dev',
        cluster: 'api-prd-example-internal:6443',
        namespace: 'portal-prd',
        current: false,
        production: true,
      },
      { name: 'kind-logdeck-test', cluster: 'kind-logdeck-test', current: false, production: false },
    ])
  })

  it('returns an empty list for an empty kubeconfig', () => {
    expect(parseGetContexts('CURRENT   NAME   CLUSTER   AUTHINFO   NAMESPACE\n')).toEqual([])
    expect(parseGetContexts('')).toEqual([])
  })

  it('does not expose the auth info column', () => {
    expect(JSON.stringify(parseGetContexts(TABLE))).not.toContain('dev/api-hml-example-internal:6443"')
  })
})

describe('isProductionContext (G5)', () => {
  it.each([
    ['portal-prd/api:6443/dev', true],
    ['PROD-cluster', true],
    ['my-production', true],
    ['portal-hml/api:6443/dev', false],
    ['kind-logdeck-test', false],
  ])('%s → %s', (name, expected) => {
    expect(isProductionContext(name)).toBe(expected)
  })
})

describe('listContexts', () => {
  it('only runs `config get-contexts` and never leaks credentials (F1.3, G3)', async () => {
    const run = vi.fn(async () => ({ stdout: TABLE, stderr: '', code: 0 }))
    const contexts = await listContexts(run)
    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith(['config', 'get-contexts'])
    expect(SECRETS.length).toBeGreaterThanOrEqual(4)
    const serialized = JSON.stringify(contexts)
    for (const secret of SECRETS) expect(serialized).not.toContain(secret)
  })

  it('throws a readable error when kubectl fails', async () => {
    const run = vi.fn(async () => ({ stdout: '', stderr: 'error: open /x/config: no such file or directory', code: 1 }))
    await expect(listContexts(run)).rejects.toThrow(/no such file/)
  })
})
