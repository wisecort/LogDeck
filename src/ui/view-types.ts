// Shared view types (no JSX), used by components and by pure modules such as tabs.ts.
import type { BuildInfo, PodInfo } from '../shared/ipc'

export interface Selection {
  context?: string
  namespace?: string
  pod?: PodInfo
  container?: string
  /** An OKD build whose pod is gone: the main area shows its details instead of a log. */
  build?: BuildInfo
}

export interface LogOptions {
  tail: number
  since: string
  previous: boolean
}
