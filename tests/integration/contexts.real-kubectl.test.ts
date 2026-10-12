// Runs the real kubectl binary against the fake kubeconfig. Offline: `config get-contexts`
// only reads the file pointed to by KUBECONFIG and never contacts a cluster.
import { spawnSync } from 'node:child_process'
import { delimiter, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseGetContexts } from '../../src/k8s/contexts'
import { FAKE_BIN, FIXTURES } from '../helpers/fake-kubectl'

const PATH_WITHOUT_FAKE = (process.env[Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH'] ?? '')
  .split(delimiter)
  .filter((p) => p !== FAKE_BIN)
  .join(delimiter)
const env = { PATH: PATH_WITHOUT_FAKE, HOME: '/nonexistent', KUBECONFIG: join(FIXTURES, 'kubectl/kubeconfig.fake.yaml') }
const hasKubectl = spawnSync('kubectl', ['version', '--client'], { env }).status === 0

describe.skipIf(!hasKubectl)('contexts with the real kubectl', () => {
  it('parses `kubectl config get-contexts` output from the fake kubeconfig', () => {
    const r = spawnSync('kubectl', ['config', 'get-contexts'], { env, encoding: 'utf8' })
    expect(r.status).toBe(0)
    expect(r.stdout).not.toContain('fake-token')
    expect(parseGetContexts(r.stdout).map((c) => [c.name, c.current, c.production])).toEqual([
      ['kind-logdeck-test', false, false],
      ['portal-hml/api-hml-example-internal:6443/dev', true, false],
      ['portal-prd/api-prd-example-internal:6443/dev', false, true],
    ])
  })
})
