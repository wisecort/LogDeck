// Container uptime and run history for the Pod tab, the status bar and the restart marks. Pure, no React.
import type { ContainerDetail, PodInfo, TerminatedRun } from '../shared/ipc'

const pad = (n: number) => String(n).padStart(2, '0')

/** Compact duration: 42s, 1m 34s, 2h 03m, 5d 3h. */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${pad(s % 60)}s`
  if (s < 86_400) return `${Math.floor(s / 3600)}h ${pad(Math.floor((s % 3600) / 60))}m`
  return `${Math.floor(s / 86_400)}d ${Math.floor((s % 86_400) / 3600)}h`
}

export function containerDetail(pod: PodInfo | undefined, container: string | undefined): ContainerDetail | undefined {
  return pod?.details?.find((c) => c.name === container)
}

/** How long the current run has been up; undefined unless the container is running. */
export function uptime(c: ContainerDetail | undefined, now: number): number | undefined {
  if (c?.state !== 'running' || c.startedAt === undefined) return undefined
  return Math.max(0, now - c.startedAt)
}

const MAX_RUNS = 10

/** Kubernetes keeps only the previous run; this collects the ones seen while LogDeck is open, newest first. */
export function recordRuns(runs: readonly TerminatedRun[], c: ContainerDetail | undefined): TerminatedRun[] {
  const last = c?.last
  if (!last || last.finishedAt === undefined) return [...runs]
  if (runs.some((r) => r.finishedAt === last.finishedAt)) return [...runs]
  return [last, ...runs].sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0)).slice(0, MAX_RUNS)
}
