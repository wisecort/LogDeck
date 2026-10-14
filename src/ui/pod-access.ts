// Pod → services (label selector) → OKD Routes / Ingresses. Pure, no React.
import type { AccessRoute, Exposure, ServiceInfo } from '../shared/ipc'

export interface PodAccess {
  services: ServiceInfo[]
  urls: AccessRoute[]
}

/** Services whose (non-empty) selector the pod's labels satisfy, and the routes/ingresses pointing at them. */
export function podAccess(labels: Readonly<Record<string, string>> | undefined, exposure: Exposure): PodAccess {
  if (!labels) return { services: [], urls: [] }
  const services = exposure.services.filter((s) => {
    const entries = Object.entries(s.selector)
    return entries.length > 0 && entries.every(([k, v]) => labels[k] === v)
  })
  const names = new Set(services.map((s) => s.name))
  return { services, urls: exposure.routes.filter((r) => names.has(r.service)) }
}
