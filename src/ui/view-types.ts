// Shared view types (no JSX), used by components and by pure modules such as tabs.ts.
import type { PodInfo } from '../shared/ipc'

export interface Selection {
  context?: string
  namespace?: string
  pod?: PodInfo
  container?: string
}

export interface LogOptions {
  tail: number
  since: string
  previous: boolean
}
