// Opening a local log file (exported with `kubectl logs --timestamps`, or any text log).
// Read in the renderer from a file the user picked; nothing touches the cluster.

export const MAX_LOG_FILE_BYTES = 200 * 1024 * 1024
const SAMPLE_CHARS = 8192

export function splitLogText(text: string): string[] {
  const body = text.startsWith('﻿') ? text.slice(1) : text
  if (body === '') return []
  const lines = body.split(/\r?\n/)
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

export type LogFileProblem = 'tooBig' | 'empty' | 'binary'

/** Returns why the file cannot be opened, or undefined. `sample` = start of the content. The UI translates the code. */
export function checkLogFile(file: { size: number }, sample: string): LogFileProblem | undefined {
  if (file.size > MAX_LOG_FILE_BYTES) return 'tooBig'
  if (file.size === 0) return 'empty'
  if (sample.slice(0, SAMPLE_CHARS).includes('\u0000')) return 'binary'
  return undefined
}

export class LogFileError extends Error {
  constructor(
    readonly problem: LogFileProblem,
    readonly fileName: string,
  ) {
    super(`${fileName}: ${problem}`)
  }
}
