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

/** Returns an error message, or undefined when the file can be opened. `sample` = start of the content. */
export function checkLogFile(file: { name: string; size: number }, sample: string): string | undefined {
  if (file.size > MAX_LOG_FILE_BYTES) return `${file.name}: arquivo grande demais (limite de ${MAX_LOG_FILE_BYTES / 1024 / 1024} MB)`
  if (file.size === 0) return `${file.name}: arquivo vazio`
  if (sample.slice(0, SAMPLE_CHARS).includes('\u0000')) return `${file.name}: não parece texto (compactado ou binário?)`
  return undefined
}
