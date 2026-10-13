import { describe, expect, it } from 'vitest'
import { UnsafeArgsError } from '../../src/k8s/args'
import { K8sService } from '../../src/k8s/service'
import { fakeKubectlEnv } from '../helpers/fake-kubectl'
import { kubectlInstallHint } from '../../src/platform/paths'

const HML = 'portal-hml/api-hml-example-internal:6443/dev'

function service(extra: Record<string, string> = {}) {
  const fake = fakeKubectlEnv(extra)
  return { svc: new K8sService({ env: fake.env }), fake }
}

describe('K8sService', () => {
  it('detects the kubectl version (F1.5)', async () => {
    const { svc } = service()
    await expect(svc.version()).resolves.toEqual({ installed: true, version: 'v1.34.1-fake' })
  })

  it('reports a missing kubectl', async () => {
    const svc = new K8sService({ binary: 'kubectl-not-installed-xyz', env: fakeKubectlEnv().env })
    const v = await svc.version()
    expect(v.installed).toBe(false)
    expect(v.message).toContain(kubectlInstallHint())
    // The welcome screen shows the install command on its own, with a copy button.
    expect(v.missing).toBe(true)
    expect(v.installHint).toBe(kubectlInstallHint())
  })

  it('does not flag an installed kubectl as missing', async () => {
    const v = await service().svc.version()
    expect(v.missing).toBeUndefined()
    expect(v.installHint).toBeUndefined()
  })

  it('lists contexts and remembers them as the allowlist for --context', async () => {
    const { svc } = service()
    const contexts = await svc.contexts()
    expect(contexts.find((c) => c.current)?.name).toBe(HML)
    expect(svc.knownContexts).toContain(HML)
  })

  it('lists namespaces when RBAC allows it (F2.1)', async () => {
    const { svc, fake } = service()
    await expect(svc.namespaces(HML)).resolves.toEqual({
      namespaces: ['default', 'monitoring', 'portal-hml'],
      canList: true,
      defaultNamespace: 'portal-hml',
    })
    expect(fake.calls().some((c) => c[0] === 'auth' && c[1] === 'can-i')).toBe(true)
  })

  it('falls back to the default namespace when listing is forbidden (OKD)', async () => {
    const { svc } = service({ FAKE_KUBECTL_CAN_I: 'no' })
    await expect(svc.namespaces(HML)).resolves.toEqual({ namespaces: ['portal-hml'], canList: false, defaultNamespace: 'portal-hml' })
  })

  it('lists pods with summaries (F2.2)', async () => {
    const { svc } = service()
    const pods = await svc.pods(HML, 'portal-hml')
    expect(pods.map((p) => p.status)).toContain('CrashLoopBackOff')
  })

  it('refuses unknown contexts and bad namespaces without spawning', async () => {
    const { svc, fake } = service()
    await svc.contexts()
    const before = fake.calls().length
    await expect(svc.pods('evil-context', 'portal-hml')).rejects.toThrow(UnsafeArgsError)
    await expect(svc.pods(HML, '$(id)')).rejects.toThrow(UnsafeArgsError)
    expect(fake.calls().length).toBe(before)
  })

  it('always passes --context and never switches the global context (G4)', async () => {
    const { svc, fake } = service()
    await svc.namespaces(HML)
    await svc.pods(HML, 'portal-hml')
    for (const call of fake.calls()) {
      expect(call).not.toContain('use-context')
      if (call[0] !== 'config' && call[0] !== 'version') expect(call).toContain(`--context=${HML}`)
    }
  })

  it('turns authentication errors into an actionable message', async () => {
    const { svc } = service({ FAKE_KUBECTL_MODE: 'auth-error' })
    await expect(svc.pods(HML, 'portal-hml')).rejects.toThrow(/oc login/)
  })
})

describe('K8sService builds (OKD)', () => {
  it('lists the builds of a namespace, newest first', async () => {
    const fake = fakeKubectlEnv()
    const svc = new K8sService({ env: fake.env })
    const builds = await svc.builds('portal-hml/api-hml-example-internal:6443/dev', 'portal-hml')
    expect(builds.map((b) => [b.name, b.phase])).toEqual([
      ['portal-web-12', 'Complete'],
      ['portal-web-11', 'Failed'],
    ])
    expect(fake.calls().at(-1)!.slice(0, 2)).toEqual(['get', 'builds.build.openshift.io'])
  })

  it('returns [] when the cluster has no Build API (plain Kubernetes) instead of failing', async () => {
    const fake = fakeKubectlEnv()
    const svc = new K8sService({ env: fake.env })
    await expect(svc.builds('portal-hml/api-hml-example-internal:6443/dev', 'monitoring')).resolves.toEqual([])
  })
})
