// How many lines each live log keeps (RNF2, 10k–500k). A per-user convenience in localStorage, like the theme.
import { DEFAULT_CAPACITY, MAX_CAPACITY } from '../logs/buffer'

export const BUFFER_CHOICES = [10_000, DEFAULT_CAPACITY, 100_000, 250_000, MAX_CAPACITY] as const

const KEY = 'logdeck.bufferLines'

/** A stored value back to a known choice; anything else is the default. */
export function parseBufferLines(raw: string | null): number {
  const n = Number(raw)
  return (BUFFER_CHOICES as readonly number[]).includes(n) ? n : DEFAULT_CAPACITY
}

export function loadBufferLines(): number {
  try {
    return parseBufferLines(localStorage.getItem(KEY))
  } catch {
    return DEFAULT_CAPACITY
  }
}

export function saveBufferLines(n: number): void {
  try {
    localStorage.setItem(KEY, String(n))
  } catch {
    // storage unavailable: the choice lasts until the window closes
  }
}
