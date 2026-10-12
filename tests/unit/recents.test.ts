import { describe, expect, it } from 'vitest'
import { pushRecent, recentKey, type RecentPod } from '../../src/ui/recents'

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
