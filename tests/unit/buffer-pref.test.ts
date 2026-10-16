import { describe, expect, it } from 'vitest'
import { DEFAULT_CAPACITY, MAX_CAPACITY } from '../../src/logs/buffer'
import { BUFFER_CHOICES, parseBufferLines } from '../../src/ui/buffer-pref'
import { LogEngine } from '../../src/ui/engine'

describe('live log line limit (RNF2: 10k–500k)', () => {
  it('offers 10k to 500k, with the default among them', () => {
    expect(BUFFER_CHOICES[0]).toBe(10_000)
    expect(BUFFER_CHOICES.at(-1)).toBe(MAX_CAPACITY)
    expect(BUFFER_CHOICES).toContain(DEFAULT_CAPACITY)
  })

  it('reads back only a known choice; anything else is the default', () => {
    expect(parseBufferLines('250000')).toBe(250_000)
    for (const raw of [null, '', 'abc', '12345', '-1', '1000000']) expect(parseBufferLines(raw)).toBe(DEFAULT_CAPACITY)
  })

  it('the engine reports the capacity it was built with', () => {
    expect(new LogEngine({ capacity: 10_000 }).capacity).toBe(10_000)
    expect(new LogEngine().capacity).toBe(DEFAULT_CAPACITY)
  })
})
