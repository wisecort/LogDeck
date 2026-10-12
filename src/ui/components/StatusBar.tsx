import type { StreamStatus } from '../../shared/ipc'
import type { Selection } from './Sidebar'

interface Props {
  status?: StreamStatus
  paused: boolean
  selection: Selection
  shown: number
  total: number
  dropped: number
  aiLabel: string
  file?: string
}

function state(status: StreamStatus | undefined, paused: boolean, file?: string): [string, string] {
  if (!status && file) return ['Arquivo', 'file']
  if (status?.state === 'live' && paused) return ['Pausado', 'paused']
  switch (status?.state) {
    case 'live':
      return ['Live', 'live']
    case 'connecting':
      return ['Conectando…', 'connecting']
    case 'reconnecting':
      return [`Reconectando (${status.attempt ?? 1}) em ${Math.round((status.retryInMs ?? 0) / 1000)}s`, 'reconnecting']
    case 'ended':
      return ['Encerrado', 'ended']
    case 'error':
      return ['Erro', 'error']
    default:
      return ['Sem log aberto', 'ended']
  }
}

export function StatusBar(p: Props) {
  const [text, cls] = state(p.status, p.paused, p.file)
  const where = p.file ?? [p.selection.context, p.selection.namespace, p.selection.pod?.name, p.selection.container].filter(Boolean).join(' › ')
  return (
    <footer className="statusbar">
      <span className={`state ${cls}`} data-testid="stream-status" title={p.status?.message ?? ''}>
        ● {text}
      </span>
      {p.status?.state === 'error' && p.status.message && <span className="error-text">{p.status.message}</span>}
      {where && (
        <span className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={where}>
          {where}
        </span>
      )}
      <span className="spacer" />
      {p.dropped > 0 && <span className="pill warn" title="Buffer cheio: as linhas mais antigas foram descartadas">{p.dropped.toLocaleString('pt-BR')} descartadas</span>}
      <span data-testid="match-count">
        {p.shown.toLocaleString('pt-BR')} / {p.total.toLocaleString('pt-BR')} linhas
      </span>
      <span>IA: {p.aiLabel}</span>
    </footer>
  )
}
