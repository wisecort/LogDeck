// Opening a local log file (exported with `kubectl logs --timestamps`, or any text log).
// Read in the renderer from a file the user picked; nothing touches the cluster.

// A file keeps every line in memory, about 4× its size (measured: ~700 bytes per 180-byte line), and the
// renderer heap stops near 4 GB: an 800 MB file took 3.3 GB, 1 GB took 3.8 GB. Above 500 MiB the user confirms
// first; above 1 GiB it is refused. Short lines mean many more entries per byte (and a Map holds at most 2^24),
// so reading also stops at MAX_LOG_FILE_LINES: the 1 GB test file had 5.7 million entries.
export const CONFIRM_LOG_FILE_BYTES = 500 * 1024 ** 2
export const MAX_LOG_FILE_BYTES = 1024 ** 3
export const MAX_LOG_FILE_LINES = 6_000_000
const SAMPLE_CHARS = 8192
const LINE_BATCH = 5000

/** Big enough to ask before opening (it takes memory and a few seconds). */
export const isLargeLogFile = (size: number): boolean => size > CONFIRM_LOG_FILE_BYTES

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

export interface LineSink {
  /** Lines in order, at most `batch` at a time; awaited, so the caller can yield to the UI. */
  onLines(lines: string[]): void | Promise<void>
  /** Fraction of the bytes read, 0 to 1. */
  onProgress?(fraction: number): void
  /** Checked between chunks: true stops reading (another file or pod was opened). */
  cancelled?(): boolean
  /** Checked after each batch: true stops reading and keeps the lines so far (too many lines for memory). */
  full?(): boolean
  batch?: number
}

const dropCR = (line: string) => (line.endsWith('\r') ? line.slice(0, -1) : line)

/**
 * Reads a log file chunk by chunk, so it is never held twice in memory (no `File.text()`).
 * Lines and UTF-8 characters split between chunks are joined; the BOM goes. `binary` when the start has NUL bytes.
 */
export async function readLogLines(stream: ReadableStream<Uint8Array>, total: number, sink: LineSink): Promise<'done' | 'cancelled' | 'binary' | 'full'> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const batch = sink.batch ?? LINE_BATCH
  const stop = (result: 'cancelled' | 'binary' | 'full') => {
    void reader.cancel()
    return result
  }
  let read = 0
  let rest = ''
  let checked = false
  const pending: string[] = []
  for (;;) {
    if (sink.cancelled?.()) return stop('cancelled')
    const { done, value } = await reader.read()
    const text = done ? decoder.decode() : decoder.decode(value, { stream: true })
    read += value?.byteLength ?? 0
    if (!checked && text) {
      if (text.slice(0, SAMPLE_CHARS).includes('\u0000')) return stop('binary')
      checked = true
    }
    const parts = (rest + text).split('\n')
    rest = parts.pop()!
    for (const line of parts) pending.push(dropCR(line))
    if (done && rest !== '') pending.push(dropCR(rest))
    while (pending.length >= batch || (done && pending.length > 0)) {
      await sink.onLines(pending.splice(0, batch))
      if (sink.cancelled?.()) return stop('cancelled')
      if (sink.full?.()) return stop('full')
    }
    sink.onProgress?.(total > 0 ? Math.min(1, read / total) : 1)
    if (done) return 'done'
  }
}
