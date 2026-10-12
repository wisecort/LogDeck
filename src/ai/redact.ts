import { todo } from '../shared/todo'

export interface RedactOptions {
  /** Also mask RFC 1918 addresses (toggle in the preview modal). */
  maskInternalIps?: boolean
}

export interface RedactResult {
  text: string
  /** Number of replacements. */
  count: number
  /** Kinds found, e.g. JWT, PASSWORD, EMAIL (unique). */
  kinds: string[]
}

/** Masks secrets before anything is sent to the AI (F7.3). Output marker: `[REDACTED:<KIND>]`. */
export function redact(text: string, opts: RedactOptions = {}): RedactResult {
  return todo(text, opts)
}
