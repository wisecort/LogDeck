import { describe, expect, it } from 'vitest'
import { activateTab, addTab, closeTab, homeTab, initialTabs, MAX_TABS, tabLabel, updateTab, type TabsState } from '../../src/ui/tabs'

const pod = (name: string) => ({ name, namespace: 'ns', phase: 'Running', status: 'Running', ready: '1/1', restarts: 0, containers: ['app'], initContainers: [], canPrevious: false, kind: 'app' as const })

describe('tabs', () => {
  it('starts with one empty active tab', () => {
    const s = initialTabs()
    expect(s.tabs).toHaveLength(1)
    expect(s.active).toBe(s.tabs[0]!.id)
  })

  it('adds a tab after the active one and activates it', () => {
    let s = initialTabs()
    s = addTab(s)!
    s = activateTab(s, s.tabs[0]!.id)
    const added = addTab(s)!
    expect(added.tabs.map((t) => t.id).indexOf(added.active)).toBe(1)
  })

  it(`refuses more than ${MAX_TABS} tabs`, () => {
    let s: TabsState = initialTabs()
    for (let i = 1; i < MAX_TABS; i++) s = addTab(s)!
    expect(addTab(s)).toBeUndefined()
  })

  it('closing the active tab activates its neighbour; closing the last one leaves a fresh empty tab', () => {
    let s = addTab(addTab(initialTabs())!)!
    const [a, b, c] = s.tabs.map((t) => t.id)
    s = closeTab(activateTab(s, b!), b!)
    expect(s.tabs.map((t) => t.id)).toEqual([a, c])
    expect(s.active).toBe(c)
    s = closeTab(closeTab(s, a!), c!)
    expect(s.tabs).toHaveLength(1)
    expect(s.tabs[0]!.id).not.toBe(c)
    expect(s.tabs[0]!.selection).toEqual({})
  })

  it('updates only the given tab', () => {
    const s = addTab(initialTabs())!
    const first = s.tabs[0]!.id
    const u = updateTab(s, first, { selection: { context: 'c', namespace: 'n' } })
    expect(u.tabs[0]!.selection).toEqual({ context: 'c', namespace: 'n' })
    expect(u.tabs[1]!.selection).toEqual({})
  })

  it('labels a tab by pod/container, file or as new', () => {
    const base = initialTabs().tabs[0]!
    expect(tabLabel(base)).toBeUndefined()
    expect(tabLabel({ ...base, file: 'app.log' })).toBe('app.log')
    expect(tabLabel({ ...base, selection: { pod: pod('web-1'), container: 'httpd' } })).toBe('web-1 / httpd')
    expect(tabLabel({ ...base, selection: { pod: pod('web-1') } })).toBe('web-1')
    expect(tabLabel({ ...base, selection: { build: { name: 'app-40', phase: 'Complete', podName: 'app-40-build' } } })).toBe('app-40')
  })
})

describe('homeTab (the Home button)', () => {
  const pod = { context: 'c', namespace: 'n', pod: { name: 'web' } as never, container: 'httpd' }
  const withPod = (s: TabsState, id: string) => updateTab(s, id, { selection: pod })

  it('stays put when the active tab already shows the home screen', () => {
    const s = initialTabs()
    expect(homeTab(s)).toBe(s)
  })

  it('switches to an existing empty tab and keeps the pod tabs running', () => {
    const a = initialTabs()
    const b = addTab(withPod(a, a.active))!
    const s = withPod(activateTab(b, b.active), b.active)
    const empty = addTab(s)!
    const back = activateTab(empty, s.active)
    const home = homeTab(back)!
    expect(home.active).toBe(empty.active)
    expect(home.tabs).toHaveLength(3)
  })

  it('adds an empty tab when every tab has a pod, without touching them', () => {
    const a = initialTabs()
    const s = withPod(a, a.active)
    const home = homeTab(s)!
    expect(home.tabs).toHaveLength(2)
    expect(home.tabs.find((t) => t.id === a.active)?.selection).toEqual(pod)
    expect(tabLabel(home.tabs.find((t) => t.id === home.active)!)).toBeUndefined()
  })

  it('is undefined at the tab limit with no empty tab', () => {
    let s = initialTabs()
    s = withPod(s, s.active)
    while (s.tabs.length < MAX_TABS) {
      s = addTab(s)!
      s = withPod(s, s.active)
    }
    expect(homeTab(s)).toBeUndefined()
  })
})
