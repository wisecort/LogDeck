import { describe, expect, it } from 'vitest'
import type { ContextInfo } from '../../src/shared/ipc'
import { contextLabel, deleteContextCommand, displayLabel, pickActiveContext, visibleContexts } from '../../src/ui/context-view'

const ctx = (name: string, current = false): ContextInfo => ({ name, cluster: 'c', current, production: /prod|prd/.test(name) })
const HML = ctx('portal-hml/api-hml-example-internal:6443/dev', true)
const PRD = ctx('portal-prd/api-prd-example-internal:6443/dev')
const KIND = ctx('kind-logdeck-test')
const ALL = [HML, PRD, KIND]

describe('pickActiveContext', () => {
  it('keeps the context the user picked last time', () => {
    expect(pickActiveContext(ALL, PRD.name)).toBe(PRD.name)
  })

  it('falls back to the kubeconfig current context when nothing (or a stale name) was saved', () => {
    expect(pickActiveContext(ALL, undefined)).toBe(HML.name)
    expect(pickActiveContext(ALL, 'gone')).toBe(HML.name)
  })

  it('uses the first context when none is current', () => {
    expect(pickActiveContext([PRD, KIND], undefined)).toBe(PRD.name)
  })

  it('returns undefined for an empty kubeconfig', () => {
    expect(pickActiveContext([], 'x')).toBeUndefined()
  })
})

describe('contextLabel', () => {
  it('splits OKD-style names into project and cluster host', () => {
    expect(contextLabel(HML.name)).toEqual({ title: 'portal-hml', subtitle: 'api-hml-example-internal' })
  })

  it('keeps plain names as they are', () => {
    expect(contextLabel('kind-logdeck-test')).toEqual({ title: 'kind-logdeck-test', subtitle: '' })
  })

  it('handles cluster/user names without a port', () => {
    expect(contextLabel('ns/cluster')).toEqual({ title: 'ns', subtitle: 'cluster' })
  })
})

describe('visibleContexts', () => {
  it('drops contexts hidden in LogDeck, keeping kubeconfig order', () => {
    expect(visibleContexts(ALL, [PRD.name])).toEqual([HML, KIND])
  })

  it('the active context is never a hidden one', () => {
    expect(pickActiveContext(visibleContexts(ALL, [HML.name]), HML.name)).toBe(PRD.name)
  })
})

describe('deleteContextCommand', () => {
  it('is only text for the user to run, with the name single-quoted', () => {
    expect(deleteContextCommand(HML.name)).toBe("kubectl config delete-context 'portal-hml/api-hml-example-internal:6443/dev'")
    expect(deleteContextCommand("a'b")).toBe("kubectl config delete-context 'a'\\''b'")
  })
})

describe('cloud context names', () => {
  it('EKS ARN shows the cluster name and region, never the account id', () => {
    const l = contextLabel('arn:aws:eks:us-east-1:123456789012:cluster/demo-cluster')
    expect(l).toEqual({ title: 'demo-cluster', subtitle: 'EKS · us-east-1' })
    expect(JSON.stringify(l)).not.toContain('123456789012')
  })

  it('GKE names show the cluster and the zone', () => {
    expect(contextLabel('gke_my-project_southamerica-east1-a_demo')).toEqual({ title: 'demo', subtitle: 'GKE · southamerica-east1-a' })
  })
})

describe('displayLabel', () => {
  const name = 'arn:aws:eks:us-east-1:123456789012:cluster/demo-cluster'
  it('a LogDeck alias replaces the whole label', () => {
    expect(displayLabel(name, { [name]: 'eks-cluster' })).toEqual({ title: 'eks-cluster', subtitle: '' })
  })

  it('without alias falls back to contextLabel; blank aliases are ignored', () => {
    expect(displayLabel(name, {})).toEqual(contextLabel(name))
    expect(displayLabel(name, { [name]: '  ' })).toEqual(contextLabel(name))
  })
})
