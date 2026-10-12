import { describe, expect, it } from 'vitest'
import { activateTab, addTab, closeTab, initialTabs, MAX_TABS, tabLabel, updateTab, type TabsState } from '../../src/ui/tabs'

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
  })
})
