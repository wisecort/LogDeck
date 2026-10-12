// "Copiar para chamado": one log line as plain text to paste into a ticket.
// Secrets are masked (same rules as the AI redaction); internal IPs are kept, they help the investigation.
import { redact } from '../ai/redact'
import type { LogEntry } from '../logs/types'

export interface TicketSource {
  context?: string
  namespace?: string
  pod?: string
  container?: string
  file?: string
}

const utc = (ms: number) => new Date(ms).toISOString().replace('T', ' ').replace('Z', ' UTC')

export function ticketText(e: LogEntry, src: TicketSource): string {
  const lines: string[] = []
  if (src.file) lines.push(`Arquivo: ${src.file}`)
  if (src.pod) {
    lines.push(`Pod: ${[src.namespace, src.pod, src.container].filter(Boolean).join(' / ')}`)
    if (src.context) lines.push(`Contexto: ${src.context}`)
  }
  if (e.k8sTime !== undefined) lines.push(`Horário (kubectl): ${utc(e.k8sTime)}`)
  if (e.logTime !== undefined) lines.push(`Horário (log): ${utc(e.logTime)}`)
  lines.push(`Nível: ${e.level}`)
  const body = redact([e.raw, ...e.continuation].join('\n')).text
  lines.push('', '```', body, '```')
  return lines.join('\n')
}
