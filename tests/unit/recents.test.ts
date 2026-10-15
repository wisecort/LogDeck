import { describe, expect, it } from 'vitest'
import type { PodInfo } from '../../src/shared/ipc'
import { findReplacement, pushRecent, recentKey, type RecentPod } from '../../src/ui/recents'

const r = (pod: string, container = 'app', context = 'ctx', namespace = 'ns'): RecentPod => ({ context, namespace, pod, container })

describe('pushRecent', () => {
  it('puts the newest first', () => {
    expect(pushRecent([r('a')], r('b')).map((x) => x.pod)).toEqual(['b', 'a'])
  })

  it('moves an existing pod to the top and keeps the latest container', () => {
    const list = pushRecent([r('a'), r('b', 'httpd')], r('b', 'php-fpm'))
    expect(list.map((x) => `${x.pod}/${x.container}`)).toEqual(['b/php-fpm', 'a/app'])
  })

  it('keeps at most 5', () => {
    let list: RecentPod[] = []
    for (const p of ['a', 'b', 'c', 'd', 'e', 'f']) list = pushRecent(list, r(p))
    expect(list.map((x) => x.pod)).toEqual(['f', 'e', 'd', 'c', 'b'])
  })

  it('the same pod name in another namespace or context is a different entry', () => {
    const list = pushRecent(pushRecent([], r('a', 'app', 'c1')), r('a', 'app', 'c2'))
    expect(list).toHaveLength(2)
    expect(recentKey(list[0]!)).not.toBe(recentKey(list[1]!))
  })
})

describe('findReplacement (a recent pod recreated under a new name)', () => {
  const pod = (name: string, extra: Partial<PodInfo> = {}): PodInfo => ({
    name,
    namespace: 'portal-hml',
    phase: 'Running',
    status: 'Running',
    ready: '1/1',
    restarts: 0,
    containers: ['httpd', 'php-fpm'],
    initContainers: [],
    canPrevious: false,
    kind: 'app',
    ...extra,
  })
  const gone = 'portal-web-7d9f8c6b5-x2k4p'

  it('finds the pod of the same deployment, preferring the same ReplicaSet', () => {
    const pods = [pod('portal-web-5c4b9d7f8-aaaaa', { createdAt: 300 }), pod('portal-web-7d9f8c6b5-q8m2n', { createdAt: 100 })]
    expect(findReplacement(gone, 'httpd', pods)?.name).toBe('portal-web-7d9f8c6b5-q8m2n')
  })

  it('after a rollout, takes the newest running pod of the deployment', () => {
    const pods = [
      pod('portal-web-5c4b9d7f8-old11', { createdAt: 100 }),
      pod('portal-web-5c4b9d7f8-new22', { createdAt: 200 }),
      pod('portal-web-5c4b9d7f8-pend3', { createdAt: 300, phase: 'Pending', status: 'ContainerCreating' }),
    ]
    expect(findReplacement(gone, 'httpd', pods)?.name).toBe('portal-web-5c4b9d7f8-new22')
  })

  it('also handles OKD DeploymentConfig pods (name-<n>-<suffix>)', () => {
    expect(findReplacement('api-3-abcde', 'api', [pod('api-4-fghij', { containers: ['api'] })])?.name).toBe('api-4-fghij')
  })

  it('never mixes deployments that share a prefix, build pods, or pods without the container', () => {
    const pods = [
      pod('portal-web-worker-6d8f7c9b4-zzzzz'),
      pod('portal-web-7d9f8c6b5-build', { kind: 'build' }),
      pod('portal-web-7d9f8c6b5-other', { containers: ['nginx'] }),
    ]
    expect(findReplacement(gone, 'httpd', pods)).toBeUndefined()
  })

  it('a name that does not look generated (StatefulSet, bare pod) has no replacement', () => {
    expect(findReplacement('mysql-0', 'mysql', [pod('mysql-1', { containers: ['mysql'] })])).toBeUndefined()
    expect(findReplacement('debug', 'httpd', [pod('debug-7d9f8c6b5-q8m2n')])).toBeUndefined()
  })
})
