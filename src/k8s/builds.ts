// OKD/OpenShift Build objects: the build history of a namespace. Their logs live in the build pod,
// which the cluster may already have pruned.
import { UnsafeArgsError, validatePodName } from './args'

export interface BuildSummary {
  name: string
  /** New, Pending, Running, Complete, Failed, Error, Cancelled */
  phase: string
  /** Why it failed, e.g. BuildPodEvicted */
  reason?: string
  /** Docker, Source, Custom, JenkinsPipeline */
  strategy?: string
  /** First 7 characters of the git commit */
  commit?: string
  startedAt?: number
  durationMs?: number
  podName: string
}

interface BuildJson {
  metadata?: { name?: string; creationTimestamp?: string; annotations?: Record<string, string> }
  spec?: { strategy?: { type?: string }; revision?: { git?: { commit?: string } } }
  status?: { phase?: string; reason?: string; startTimestamp?: string; duration?: number }
}

const POD_ANNOTATION = 'openshift.io/build.pod-name'

const safe = (name: string): boolean => {
  try {
    validatePodName(name)
    return true
  } catch (err) {
    if (err instanceof UnsafeArgsError) return false
    throw err
  }
}

/** Newest first; names that are not valid DNS-1123 are dropped (they would end up in kubectl argv). */
export function parseBuilds(json: string): BuildSummary[] {
  const parsed = JSON.parse(json) as { items?: BuildJson[] }
  const out: Array<{ build: BuildSummary; sort: number }> = []
  for (const b of Array.isArray(parsed.items) ? parsed.items : []) {
    const name = b.metadata?.name ?? ''
    const podName = b.metadata?.annotations?.[POD_ANNOTATION] ?? `${name}-build`
    if (!safe(name) || !safe(podName)) continue
    const summary: BuildSummary = { name, phase: b.status?.phase ?? 'Unknown', podName }
    if (b.status?.reason) summary.reason = b.status.reason
    if (b.spec?.strategy?.type) summary.strategy = b.spec.strategy.type
    if (b.spec?.revision?.git?.commit) summary.commit = b.spec.revision.git.commit.slice(0, 7)
    const started = Date.parse(b.status?.startTimestamp ?? '')
    if (!Number.isNaN(started)) summary.startedAt = started
    if (typeof b.status?.duration === 'number') summary.durationMs = Math.round(b.status.duration / 1e6)
    out.push({ build: summary, sort: Number.isNaN(started) ? Date.parse(b.metadata?.creationTimestamp ?? '') || 0 : started })
  }
  return out.sort((a, b) => b.sort - a.sort).map((x) => x.build)
}
