// Masks secrets before anything is sent to an AI provider (F7.3). Runs in the main process.
// Every replacement uses `[REDACTED:<KIND>]`, and patterns skip values already masked (idempotent).

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

type Rule = [kind: string, re: RegExp, replace: (...match: string[]) => string]

const mark = (kind: string) => `[REDACTED:${kind}]`
const NOT_MASKED = '(?!\\[REDACTED)'

const RULES: readonly Rule[] = [
  ['PRIVATE_KEY', /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, () => mark('PRIVATE_KEY')],
  ['JWT', /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, () => mark('JWT')],
  [
    'URL_CREDENTIALS',
    new RegExp(`\\b([a-z][a-z0-9+.-]*://)${NOT_MASKED}([^\\s:@/]*:[^\\s@/]+)@`, 'gi'),
    (_m, scheme) => `${scheme}${mark('URL_CREDENTIALS')}@`,
  ],
  ['AWS_KEY', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, () => mark('AWS_KEY')],
  ['GCP_KEY', /\bAIza[0-9A-Za-z_-]{35}\b/g, () => mark('GCP_KEY')],
  ['BEARER', new RegExp(`\\b(Bearer)\\s+${NOT_MASKED}[A-Za-z0-9._~+/=-]+`, 'g'), (_m, word) => `${word} ${mark('BEARER')}`],
  [
    'PASSWORD',
    new RegExp(`(["']?)\\b([A-Za-z0-9_]*pass(?:word|wd)|pwd)\\1(\\s*[:=]\\s*)(["']?)${NOT_MASKED}([^"'&\\s,;}]+)\\4`, 'gi'),
    (_m, q1, key, sep, q2) => `${q1}${key}${q1}${sep}${q2}${mark('PASSWORD')}${q2}`,
  ],
  [
    'SECRET',
    new RegExp(
      `(["']?)\\b([A-Za-z0-9_-]*(?:secret|token|api[_-]?key|access[_-]?key))\\1(\\s*[:=]\\s*)(["']?)${NOT_MASKED}([^"'&\\s,;}]{3,})\\4`,
      'gi',
    ),
    (_m, q1, key, sep, q2) => `${q1}${key}${q1}${sep}${q2}${mark('SECRET')}${q2}`,
  ],
  ['EMAIL', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, () => mark('EMAIL')],
]

const INTERNAL_IP: Rule = [
  'IP',
  /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g,
  () => mark('IP'),
]

export function redact(text: string, opts: RedactOptions = {}): RedactResult {
  let count = 0
  const kinds: string[] = []
  let out = text
  for (const [kind, re, replace] of opts.maskInternalIps ? [...RULES, INTERNAL_IP] : RULES) {
    out = out.replace(re, (...args: string[]) => {
      count++
      if (!kinds.includes(kind)) kinds.push(kind)
      return replace(...args)
    })
  }
  return { text: out, count, kinds }
}
