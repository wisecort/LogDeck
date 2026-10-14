import type { StreamStatus } from '../../shared/ipc'
import { useI18n, type Translate } from '../i18n'
import { formatDuration } from '../pod-status'
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
  /** Context as shown to the user (alias when set). */
  contextName?: string
  /** Production context (G5): a red PROD badge next to the location. */
  production?: boolean
  /** Newer LogDeck version available (only after the user opted in to the check). */
  update?: string
  onUpdate?(): void
  /** Time since the tab's container last started. */
  uptime?: { ms: number; container: string; restarts: number }
}

function state(t: Translate, status: StreamStatus | undefined, paused: boolean, file?: string): [string, string] {
  if (!status && file) return [t('st.file'), 'file']
  if (status?.state === 'live' && paused) return [t('st.paused'), 'paused']
  switch (status?.state) {
    case 'live':
      return [t('st.live'), 'live']
    case 'connecting':
      return [t('st.connecting'), 'connecting']
    case 'reconnecting':
      return [t('st.reconnecting', { n: status.attempt ?? 1, s: Math.round((status.retryInMs ?? 0) / 1000) }), 'reconnecting']
    case 'ended':
      return [t('st.ended'), 'ended']
    case 'error':
      return [t('st.error'), 'error']
    default:
      return [t('st.none'), 'ended']
  }
}

export function StatusBar(p: Props) {
  const { t, n } = useI18n()
  const [text, cls] = state(t, p.status, p.paused, p.file)
  const parts = p.file ? [p.file] : [p.contextName ?? p.selection.context, p.selection.namespace, p.selection.pod?.name ?? p.selection.build?.name, p.selection.container].filter((x): x is string => !!x)
  const where = parts.join(' › ')
  return (
    <footer className="statusbar">
      <span className={`state ${cls}`} data-testid="stream-status" title={p.status?.message ?? ''}>
        <span className="status-dot" />
        {text}
      </span>
      {p.status?.state === 'error' && p.status.message && <span className="error-text">{p.status.message}</span>}
      {p.production && (
        <span className="pill bad prod-pill" data-testid="prod-badge" title={t('prod.hint')}>
          PROD
        </span>
      )}
      {where && (
        <span className="mono where" title={where}>
          {parts.map((part, i) => (
            <span key={i}>
              {i > 0 && <span className="sep"> › </span>}
              {part}
            </span>
          ))}
        </span>
      )}
      <span className="spacer" />
      {p.uptime && (
        <span data-testid="uptime" title={t('st.uptimeHint', { name: p.uptime.container, n: p.uptime.restarts })}>
          ▶ {t('st.uptime', { d: formatDuration(p.uptime.ms) })}
          {p.uptime.restarts > 0 && <span className="muted"> · ↻{p.uptime.restarts}</span>}
        </span>
      )}
      {p.dropped > 0 && (
        <span className="pill warn" title={t('st.droppedHint')}>
          {t('st.dropped', { n: n(p.dropped) })}
        </span>
      )}
      <span data-testid="match-count">{t('st.lines', { shown: n(p.shown), total: n(p.total) })}</span>
      <span>{t('st.ai', { label: p.aiLabel })}</span>
      {p.update && (
        <button className="pill ok update-pill" data-testid="update-pill" title={t('upd.title', { v: p.update })} onClick={p.onUpdate}>
          {t('upd.available', { v: p.update })}
        </button>
      )}
    </footer>
  )
}
