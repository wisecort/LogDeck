// Shared view types (no JSX), used by components and by pure modules such as tabs.ts.
import type { BuildInfo, PodInfo } from '../shared/ipc'

export interface Selection {
  context?: string
  namespace?: string
  pod?: PodInfo
  container?: string
  /** An OKD build whose pod is gone: the main area shows its details instead of a log. */
  build?: BuildInfo
  /** Replicas of one workload read together (no `pod`): its kind, name and the pods followed. */
  group?: PodGroup
}

export interface PodGroup {
  kind: string
  name: string
  pods: string[]
}

export interface LogOptions {
  tail: number
  since: string
  previous: boolean
}
