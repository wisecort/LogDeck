// Turns the AI answer into blocks the UI renders as text (F7.5, F7.6).

import type { ResponseBlock } from '../shared/ai'

export type { ResponseBlock } from '../shared/ai'

const REVIEWABLE = new Set(['diff', 'patch', 'yaml', 'yml'])

export function parseResponse(text: string): ResponseBlock[] {
  const blocks: ResponseBlock[] = []
  let buffer: string[] = []
  let fence: string | undefined

  const flush = () => {
    const content = buffer.join('\n')
    if (fence !== undefined) {
      blocks.push({ type: REVIEWABLE.has(fence.toLowerCase()) ? 'diff' : 'code', lang: fence, content })
    } else if (content.trim()) {
      blocks.push({ type: 'text', content: content.trim() })
    }
    buffer = []
  }

  for (const line of text.split('\n')) {
    const m = /^```\s*([\w-]*)\s*$/.exec(line)
    if (m) {
      flush()
      fence = fence === undefined ? m[1]! : undefined
      continue
    }
    buffer.push(line)
  }
  flush()
  return blocks
}

const WRITE_VERBS = new Set([
  'delete', 'apply', 'patch', 'scale', 'rollout', 'edit', 'create', 'replace', 'set', 'label', 'annotate',
  'cordon', 'uncordon', 'drain', 'taint', 'expose', 'autoscale', 'exec', 'cp', 'debug', 'run', 'adm',
])
const VALUE_FLAGS = new Set(['-n', '--namespace', '-c', '--container', '--context', '-l', '--selector', '-f', '--filename'])

/** kubectl/oc commands in the answer that would change the cluster (shown with a warning). */
export function writeCommands(text: string): string[] {
  const found: string[] = []
  for (const m of text.matchAll(/\b(kubectl|oc)\s+([^\n`]*)/g)) {
    const tokens = m[2]!.trim().split(/\s+/)
    let verb: string | undefined
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]!
      if (t.startsWith('-')) {
        if (VALUE_FLAGS.has(t)) i++
        continue
      }
      verb = t
      break
    }
    if (verb && WRITE_VERBS.has(verb)) found.push(`${m[1]} ${m[2]!.trim()}`)
  }
  return found
}

/** The AI self-estimate from the "## Confiança" / "## Confidence" / "## Confianza" section (0–100), shown as an estimate only. */
export function extractConfidence(text: string): number | undefined {
  const m = /(?:Confian[çc]a|Confidence|Confianza)[^\n]*?\n?[^\n]*?(\d{1,3})\s*%/i.exec(text)
  if (!m) return undefined
  const n = Number(m[1])
  return n >= 0 && n <= 100 ? n : undefined
}
