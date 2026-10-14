import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseIngresses, parseRoutes, parseServices } from '../../src/k8s/exposure'
import { podAccess } from '../../src/ui/pod-access'
import { FIXTURES } from '../helpers/fake-kubectl'

const read = (name: string) => readFileSync(join(FIXTURES, 'kubectl', name), 'utf8')
const services = parseServices(read('services.json'))
const routes = [...parseRoutes(read('routes.json')), ...parseIngresses(read('ingresses.json'))]

describe('parseServices', () => {
  it('reads name, type, selector and ports; ExternalName has no selector', () => {
    expect(services[0]).toEqual({ name: 'portal-web', type: 'ClusterIP', selector: { app: 'portal-web' }, ports: [{ name: 'http', port: 80, targetPort: '8080' }] })
    expect(services.find((s) => s.name === 'external-db')).toMatchObject({ type: 'ExternalName', selector: {} })
  })
})

describe('parseRoutes (OKD) and parseIngresses', () => {
  it('builds the URL from host, path and TLS', () => {
    expect(routes.filter((r) => r.kind === 'route')).toEqual([
      { kind: 'route', name: 'portal-web', service: 'portal-web', url: 'https://portal-hml.apps.example.internal/' },
      { kind: 'route', name: 'portal-web-api', service: 'portal-web', url: 'http://api-hml.apps.example.internal/api' },
    ])
  })

  it('makes one entry per ingress rule path, https when the host is in tls', () => {
    expect(routes.filter((r) => r.kind === 'ingress')).toEqual([
      { kind: 'ingress', name: 'portal-web', service: 'portal-web', url: 'https://portal.example.internal/' },
      { kind: 'ingress', name: 'portal-web', service: 'portal-worker', url: 'http://status.example.internal/health' },
    ])
  })

  it('ignores routes without a host or a target and returns [] for empty lists', () => {
    expect(parseRoutes(JSON.stringify({ items: [{ spec: { to: { name: 'x' } } }, { spec: { host: 'a.example.internal' } }] }))).toEqual([])
    expect(parseIngresses('{}')).toEqual([])
  })
})

describe('podAccess: pod → services (label selector) → routes/ingresses', () => {
  it('finds the services that select the pod and their URLs', () => {
    const access = podAccess({ app: 'portal-web', 'pod-template-hash': '7d9f8c6b5' }, { services, routes })
    expect(access.services.map((s) => s.name)).toEqual(['portal-web'])
    expect(access.urls.map((u) => u.url)).toEqual(['https://portal-hml.apps.example.internal/', 'http://api-hml.apps.example.internal/api', 'https://portal.example.internal/'])
  })

  it('a service with an empty selector never matches, and a pod without labels has no access', () => {
    expect(podAccess({ app: 'external-db' }, { services, routes }).services).toEqual([])
    expect(podAccess(undefined, { services, routes })).toEqual({ services: [], urls: [] })
  })
})
