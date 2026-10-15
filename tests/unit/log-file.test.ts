import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { checkLogFile, CONFIRM_LOG_FILE_BYTES, isLargeLogFile, MAX_LOG_FILE_BYTES, MAX_LOG_FILE_LINES, readLogLines, splitLogText } from '../../src/logs/file'
import { LogAssembler } from '../../src/logs/classify'

describe('splitLogText', () => {
  it('splits LF and CRLF, dropping the trailing empty line and a BOM', () => {
    expect(splitLogText('﻿a\r\nb\nc\n')).toEqual(['a', 'b', 'c'])
  })

  it('keeps blank lines in the middle', () => {
    expect(splitLogText('a\n\nb')).toEqual(['a', '', 'b'])
  })

  it('an empty file has no lines', () => {
    expect(splitLogText('')).toEqual([])
  })

  it('a kubectl --timestamps dump keeps the k8s time once assembled', () => {
    const lines = splitLogText(readFileSync('tests/fixtures/pod-php-apache.log', 'utf8'))
    const asm = new LogAssembler()
    const first = asm.push(lines[0]!)
    expect(first.type === 'entry' && first.entry.k8sTime).toBe(Date.parse('2026-10-09T03:24:00.000582Z'))
  })
})

describe('checkLogFile', () => {
  it('accepts a normal text log', () => {
    expect(checkLogFile({ size: 10 }, 'hello\n')).toBeUndefined()
  })

  it('refuses files above the size limit', () => {
    expect(checkLogFile({ size: MAX_LOG_FILE_BYTES + 1 }, '')).toBe('tooBig')
  })

  it('refuses empty files', () => {
    expect(checkLogFile({ size: 0 }, '')).toBe('empty')
  })

  it('refuses binary content (NUL bytes) such as a .gz', () => {
    expect(checkLogFile({ size: 4 }, '\u001f\u008b\u0000\u0000')).toBe('binary')
  })
})

describe('size limits (1.6.3: memory, not an arbitrary cut)', () => {
  it('opens up to 1 GiB, asking first above 500 MiB', () => {
    expect(MAX_LOG_FILE_BYTES).toBe(1024 ** 3)
    expect(CONFIRM_LOG_FILE_BYTES).toBe(500 * 1024 ** 2)
    expect(isLargeLogFile(CONFIRM_LOG_FILE_BYTES)).toBe(false)
    expect(isLargeLogFile(CONFIRM_LOG_FILE_BYTES + 1)).toBe(true)
    expect(checkLogFile({ size: 900 * 1024 ** 2 }, 'x')).toBeUndefined()
    expect(MAX_LOG_FILE_LINES).toBeLessThan(2 ** 24)
  })
})

/** A byte stream cut at the given offsets, to test lines and UTF-8 characters split between chunks. */
function streamOf(bytes: Uint8Array, cuts: number[]): ReadableStream<Uint8Array> {
  const parts: Uint8Array[] = []
  let from = 0
  for (const at of [...cuts, bytes.length]) {
    parts.push(bytes.slice(from, at))
    from = at
  }
  return new ReadableStream({
    pull(controller) {
      const next = parts.shift()
      if (next) controller.enqueue(next)
      else controller.close()
    },
  })
}

describe('readLogLines (streamed, no full copy in memory)', () => {
  const text = '\ufeffprimeira linha\r\nação ñ 日本\nterceira\n\núltima sem quebra'
  const bytes = new TextEncoder().encode(text)

  it('gives the same lines as splitLogText, whatever the chunk boundaries', async () => {
    for (const cuts of [[], [1], [5, 17, 18], Array.from({ length: bytes.length - 1 }, (_, i) => i + 1)]) {
      const got: string[] = []
      const result = await readLogLines(streamOf(bytes, cuts), bytes.length, { onLines: (l) => void got.push(...l) })
      expect(result).toBe('done')
      expect(got).toEqual(splitLogText(text))
    }
  })

  it('sends lines in batches and reports progress up to 100%', async () => {
    const many = new TextEncoder().encode(Array.from({ length: 25 }, (_, i) => `l${i}`).join('\n') + '\n')
    const batches: number[] = []
    const progress: number[] = []
    await readLogLines(streamOf(many, [10, 40]), many.length, {
      batch: 10,
      onLines: (l) => void batches.push(l.length),
      onProgress: (p) => void progress.push(p),
    })
    expect(batches).toEqual([10, 10, 5])
    expect(progress.at(-1)).toBe(1)
    expect(progress).toEqual([...progress].sort((a, b) => a - b))
  })

  it('stops when cancelled (another file or pod opened meanwhile)', async () => {
    const many = new TextEncoder().encode('a\nb\nc\nd\n')
    const got: string[] = []
    let calls = 0
    const result = await readLogLines(streamOf(many, [2, 4, 6]), many.length, {
      batch: 1,
      onLines: (l) => void got.push(...l),
      cancelled: () => ++calls > 2,
    })
    expect(result).toBe('cancelled')
    expect(got.length).toBeLessThan(4)
  })

  it('stops with what it has when there are too many lines (short lines: many more per byte)', async () => {
    const many = new TextEncoder().encode('a\nb\nc\nd\ne\nf\n')
    const got: string[] = []
    const result = await readLogLines(streamOf(many, [2, 4, 6, 8]), many.length, {
      batch: 1,
      onLines: (l) => void got.push(...l),
      full: () => got.length >= 3,
    })
    expect(result).toBe('full')
    expect(got).toEqual(['a', 'b', 'c'])
  })

  it('refuses binary content found in the first chunk, before sending any line', async () => {
    const got: string[] = []
    const gz = new Uint8Array([0x1f, 0x8b, 0, 0, 10, 65])
    expect(await readLogLines(streamOf(gz, []), gz.length, { onLines: (l) => void got.push(...l) })).toBe('binary')
    expect(got).toEqual([])
  })
})
