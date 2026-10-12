import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { checkLogFile, MAX_LOG_FILE_BYTES, splitLogText } from '../../src/logs/file'
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
