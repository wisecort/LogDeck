import { describe, expect, it } from 'vitest'
import type { PodInfo } from '../../src/shared/ipc'
import { groupMembers, groupPods, MAX_GROUP_PODS, sharedContainer } from '../../src/ui/workloads'

const pod = (name: string, extra: Partial<PodInfo> = {}): PodInfo => ({
  name,
  namespace: 'ns',
  phase: 'Running',
  status: 'Running',
  ready: '1/1',
  restarts: 0,
  containers: ['app'],
  initContainers: [],
  canPrevious: false,
  kind: 'app',
  ...extra,
})
const sts = { kind: 'StatefulSet', name: 'cache' }
const dep = { kind: 'Deployment', name: 'web' }

describe('groupPods (sidebar)', () => {
  it('puts pods with the same owner under one group, where the first of them was', () => {
    const items = groupPods([pod('a'), pod('cache-0', { owner: sts }), pod('b'), pod('cache-1', { owner: sts })])
    expect(items.map((i) => ('group' in i ? `group:${i.group.name}(${i.pods.length})` : i.pod.name))).toEqual(['a', 'group:cache(2)', 'b'])
  })

  it('a single pod with an owner stays a plain row', () => {
    const items = groupPods([pod('web-1', { owner: dep })])
    expect(items).toEqual([{ pod: expect.objectContaining({ name: 'web-1' }) }])
  })

  it('same name with another kind is another group', () => {
    const items = groupPods([pod('x-0', { owner: sts }), pod('x-1', { owner: { kind: 'Deployment', name: 'cache' } })])
    expect(items.every((i) => 'pod' in i)).toBe(true)
  })
})

describe('groupMembers', () => {
  it('keeps the pods of the owner that still run, in name order', () => {
    const pods = [pod('cache-1', { owner: sts }), pod('cache-0', { owner: sts }), pod('other'), pod('cache-2', { owner: sts, phase: 'Succeeded' })]
    const m = groupMembers(pods, sts)
    expect(m.pods.map((p) => p.name)).toEqual(['cache-0', 'cache-1'])
    expect(m.total).toBe(2)
  })

  it(`opens at most ${MAX_GROUP_PODS} pods, the newest`, () => {
    const pods = Array.from({ length: 12 }, (_, i) => pod(`web-${String(i).padStart(2, '0')}`, { owner: dep, createdAt: i }))
    const m = groupMembers(pods, dep)
    expect(m.total).toBe(12)
    expect(m.pods).toHaveLength(MAX_GROUP_PODS)
    expect(m.pods[0]!.name).toBe('web-02')
  })
})

describe('sharedContainer', () => {
  it('prefers the asked container when every pod has it, else the first container', () => {
    const pods = [pod('a', { containers: ['app', 'proxy'] }), pod('b', { containers: ['app', 'proxy'] })]
    expect(sharedContainer(pods, 'proxy')).toBe('proxy')
    expect(sharedContainer(pods, 'nope')).toBe('app')
    expect(sharedContainer(pods)).toBe('app')
  })

  it('undefined when the pods share no container', () => {
    expect(sharedContainer([pod('a', { containers: ['x'] }), pod('b', { containers: ['y'] })])).toBeUndefined()
    expect(sharedContainer([])).toBeUndefined()
  })
})
