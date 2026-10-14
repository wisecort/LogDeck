// Services, OKD Routes and Ingresses of a namespace: how a pod is reached. Cluster text is data (G7).
import type { AccessRoute, ServiceInfo } from '../shared/ipc'
import { stringMap } from './pods'

interface ServiceJson {
  metadata?: { name?: string }
  spec?: { type?: string; selector?: Record<string, unknown>; ports?: Array<{ name?: string; port?: number; targetPort?: number | string }> }
}

interface RouteJson {
  metadata?: { name?: string }
  spec?: { host?: string; path?: string; to?: { name?: string }; tls?: unknown }
}

interface IngressJson {
  metadata?: { name?: string }
  spec?: {
    tls?: Array<{ hosts?: string[] }>
    rules?: Array<{ host?: string; http?: { paths?: Array<{ path?: string; backend?: { service?: { name?: string } } }> } }>
  }
}

const HOST = /^(\*\.)?[a-z0-9]([-a-z0-9.]{0,251}[a-z0-9])?$/i
const name = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length <= 253 ? v : undefined)
const path = (v: unknown) => (typeof v === 'string' && v.startsWith('/') ? v.slice(0, 200) : '/')

function items<T>(json: string): T[] {
  const parsed = JSON.parse(json) as { items?: T[] }
  return Array.isArray(parsed.items) ? parsed.items : []
}

export function parseServices(json: string): ServiceInfo[] {
  const out: ServiceInfo[] = []
  for (const s of items<ServiceJson>(json)) {
    const n = name(s.metadata?.name)
    if (!n) continue
    const ports: ServiceInfo['ports'] = []
    for (const p of s.spec?.ports ?? []) {
      if (typeof p.port !== 'number') continue
      ports.push({
        ...(name(p.name) && { name: p.name!.slice(0, 63) }),
        port: p.port,
        ...(p.targetPort !== undefined && { targetPort: String(p.targetPort).slice(0, 63) }),
      })
    }
    out.push({ name: n, type: name(s.spec?.type) ?? 'ClusterIP', selector: stringMap(s.spec?.selector) ?? {}, ports })
  }
  return out
}

export function parseRoutes(json: string): AccessRoute[] {
  const out: AccessRoute[] = []
  for (const r of items<RouteJson>(json)) {
    const host = r.spec?.host
    const service = name(r.spec?.to?.name)
    if (typeof host !== 'string' || !HOST.test(host) || !service) continue
    const scheme = r.spec?.tls ? 'https' : 'http'
    out.push({ kind: 'route', name: name(r.metadata?.name) ?? service, service, url: `${scheme}://${host}${path(r.spec?.path)}` })
  }
  return out
}

export function parseIngresses(json: string): AccessRoute[] {
  const out: AccessRoute[] = []
  for (const ing of items<IngressJson>(json)) {
    const tlsHosts = new Set((ing.spec?.tls ?? []).flatMap((t) => t.hosts ?? []))
    for (const rule of ing.spec?.rules ?? []) {
      const host = rule.host
      if (typeof host !== 'string' || !HOST.test(host)) continue
      for (const p of rule.http?.paths ?? []) {
        const service = name(p.backend?.service?.name)
        if (!service) continue
        const scheme = tlsHosts.has(host) ? 'https' : 'http'
        out.push({ kind: 'ingress', name: name(ing.metadata?.name) ?? service, service, url: `${scheme}://${host}${path(p.path)}` })
      }
    }
  }
  return out
}
