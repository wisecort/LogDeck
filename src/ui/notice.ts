// The notice on top of the window: what kind it is decides its color and its short title.
// kubectl errors arrive as text from main (src/k8s/messages.ts); the kind is read back from that text,
// so the IPC contract stays a plain string.
import { texts } from '../k8s/messages'

export type NoticeKind =
  | 'auth'
  | 'forbidden'
  | 'unreachable'
  | 'notFound'
  | 'noContext'
  | 'plugin'
  | 'timeout'
  | 'missing'
  | 'error'
  | 'noContexts'
  | 'recentGone'
  | 'tabsLimit'

export interface Notice {
  kind: NoticeKind
  text: string
}

const LANGS = ['pt-BR', 'pt-PT', 'en', 'es']
const KUBECTL_KINDS = ['auth', 'forbidden', 'unreachable', 'notFound', 'noContext', 'plugin', 'timeout', 'missing'] as const
const WARN: ReadonlySet<NoticeKind> = new Set(['noContexts', 'recentGone', 'tabsLimit'])

/** Kind of a kubectl error message, in any interface language; `error` when it is none of the known ones. */
export function noticeFromError(text: string): Notice {
  for (const lang of LANGS) {
    const tx = texts(lang)
    const kind = KUBECTL_KINDS.find((k) => text.startsWith(tx[k].split('{')[0]!))
    if (kind) return { kind, text }
  }
  return { kind: 'error', text }
}

/** Cluster and kubectl errors are red; warnings about the app itself (tabs, recents, kubeconfig) are amber. */
export const noticeTone = (kind: NoticeKind): 'error' | 'warn' => (WARN.has(kind) ? 'warn' : 'error')
