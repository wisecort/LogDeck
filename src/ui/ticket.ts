// Copying one log line from Details. "Copiar com detalhes": plain text to paste into a ticket or chat, with secrets
// masked (same rules as the AI redaction) and internal IPs kept. "Copiar": the line itself, optionally masked.
import { redact } from '../ai/redact'
import type { LogEntry } from '../logs/types'

export interface TicketSource {
  context?: string
  namespace?: string
  pod?: string
  container?: string
  file?: string
}

export interface TicketLabels {
  file: string
  pod: string
  context: string
  k8sTime: string
  logTime: string
  level: string
}

const PT_BR: TicketLabels = { file: 'Arquivo', pod: 'Pod', context: 'Contexto', k8sTime: 'Horário (kubectl)', logTime: 'Horário (log)', level: 'Nível' }

const utc = (ms: number) => new Date(ms).toISOString().replace('T', ' ').replace('Z', ' UTC')

export function ticketText(e: LogEntry, src: TicketSource, l: TicketLabels = PT_BR): string {
  const lines: string[] = []
  if (src.file) lines.push(`${l.file}: ${src.file}`)
  if (src.pod) {
    lines.push(`${l.pod}: ${[src.namespace, src.pod, src.container].filter(Boolean).join(' / ')}`)
    if (src.context) lines.push(`${l.context}: ${src.context}`)
  }
  if (e.k8sTime !== undefined) lines.push(`${l.k8sTime}: ${utc(e.k8sTime)}`)
  if (e.logTime !== undefined) lines.push(`${l.logTime}: ${utc(e.logTime)}`)
  lines.push(`${l.level}: ${e.level}`)
  const body = redact([e.raw, ...e.continuation].join('\n')).text
  lines.push('', '```', body, '```')
  return lines.join('\n')
}

/** Details → Copiar: the line and its stack trace; `mask` hides secrets and internal (RFC 1918) IPs. */
export function lineText(e: LogEntry, { mask = false }: { mask?: boolean } = {}): string {
  const text = [e.raw, ...e.continuation].join('\n')
  return mask ? redact(text, { maskInternalIps: true }).text : text
}
