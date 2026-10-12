import { todo } from '../shared/todo'
import type { LogEntry } from './types'

/** Log time and k8s time further apart than this are both shown (P2). */
export const DIVERGENCE_MS = 2000

export function splitK8sTimestamp(line: string): { k8sTime?: number; rest: string } {
  return todo(line)
}

/** True for stack-trace style lines that belong to the previous entry. */
export function isContinuation(rest: string): boolean {
  return todo(rest)
}

export type AssembleEvent =
  | { type: 'entry'; entry: LogEntry }
  | { type: 'continuation'; seq: number; text: string }

export interface AssembleOptions {
  now?: () => number
  startSeq?: number
}

/** Streaming line → entry assembler (parsing, timestamps, multiline). */
export class LogAssembler {
  constructor(private readonly opts: AssembleOptions = {}) {}

  push(rawLine: string): AssembleEvent {
    return todo(rawLine, this.opts)
  }
}

export function assemble(lines: readonly string[], opts: AssembleOptions = {}): LogEntry[] {
  return todo(lines, opts)
}

export interface DisplayTime {
  time?: number
  source: 'log' | 'k8s' | 'none'
  divergent: boolean
}

export function displayTime(entry: Pick<LogEntry, 'k8sTime' | 'logTime' | 'ingestTime'>): DisplayTime {
  return todo(entry)
}
