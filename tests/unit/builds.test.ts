import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { assertReadOnly, buildGetBuildsArgs, UnsafeArgsError } from '../../src/k8s/args'
import { parseBuilds } from '../../src/k8s/builds'

const BUILDS = readFileSync('tests/fixtures/kubectl/builds.json', 'utf8')
const CTX = { context: 'portal-hml/api-hml-example-internal:6443/dev', knownContexts: ['portal-hml/api-hml-example-internal:6443/dev'] }

describe('parseBuilds (OKD Build objects)', () => {
  const builds = parseBuilds(BUILDS)

  it('newest first, with phase, reason, strategy, short commit, start, duration and pod name', () => {
    expect(builds.map((b) => b.name)).toEqual(['portal-web-12', 'portal-web-11'])
    expect(builds[0]).toEqual({
      name: 'portal-web-12',
      phase: 'Complete',
      strategy: 'Source',
      commit: '093866f',
      startedAt: Date.parse('2026-10-09T03:10:02Z'),
      durationMs: 435_000,
      podName: 'portal-web-12-build',
    })
    expect(builds[1]).toMatchObject({ phase: 'Failed', reason: 'BuildPodEvicted', durationMs: 218_000 })
  })

  it('falls back to <build>-build when the pod-name annotation is missing, and drops unsafe names', () => {
    const json = JSON.stringify({ items: [{ metadata: { name: 'app-3' }, status: { phase: 'Running' } }, { metadata: { name: 'x;rm -rf /' } }] })
    expect(parseBuilds(json)).toEqual([{ name: 'app-3', phase: 'Running', podName: 'app-3-build' }])
  })
})

describe('get builds is read-only and namespaced (G1, G2)', () => {
  it('builds the argv with -n, -o json and --context', () => {
    const args = buildGetBuildsArgs({ ...CTX, namespace: 'portal-hml' })
    expect(args).toEqual(['get', 'builds.build.openshift.io', '-n', 'portal-hml', '-o', 'json', '--context=portal-hml/api-hml-example-internal:6443/dev'])
    expect(() => assertReadOnly(args)).not.toThrow()
  })

  it('refuses other OpenShift resources and bad namespaces', () => {
    expect(() => assertReadOnly(['get', 'buildconfigs', '-n', 'x', '--context=c'])).toThrow(UnsafeArgsError)
    expect(() => assertReadOnly(['get', 'secrets', '-n', 'x', '--context=c'])).toThrow(UnsafeArgsError)
    expect(() => buildGetBuildsArgs({ ...CTX, namespace: 'Bad_NS' })).toThrow(UnsafeArgsError)
  })
})
