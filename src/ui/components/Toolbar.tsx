import type { StreamStatus } from '../../shared/ipc'

export interface LogOptions {
  tail: number
  since: string
  previous: boolean
}

interface Props {
  status?: StreamStatus
  paused: boolean
  onPause(): void
  options: LogOptions
  onOptions(o: LogOptions): void
  canPrevious: boolean
  onReconnect(): void
  dropped: number
  canShell: boolean
  onShell(): void
  onAiPreferences(): void
}

function label(status: StreamStatus | undefined, paused: boolean): [string, string] {
  if (paused) return ['Pausado', 'paused']
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
      return ['Parado', 'ended']
  }
}

export function Toolbar(p: Props) {
  const [text, cls] = label(p.status, p.paused)
  return (
    <div className="toolbar">
      <span className={`status ${cls}`} data-testid="stream-status" title={p.status?.message ?? ''}>
        ● {text}
      </span>
      <button onClick={p.onPause} disabled={!p.status}>
        {p.paused ? '▶ Retomar' : '⏸ Pausar'}
      </button>
      <label>
        tail
        <select aria-label="tail" value={p.options.tail} onChange={(e) => p.onOptions({ ...p.options, tail: Number(e.target.value) })}>
          {[100, 1000, 5000, 20000, -1].map((n) => (
            <option key={n} value={n}>
              {n === -1 ? 'tudo' : n}
            </option>
          ))}
        </select>
      </label>
      <label>
        desde
        <select aria-label="since" value={p.options.since} onChange={(e) => p.onOptions({ ...p.options, since: e.target.value })}>
          {['', '5m', '15m', '1h', '6h', '24h'].map((s) => (
            <option key={s} value={s}>
              {s || '—'}
            </option>
          ))}
        </select>
      </label>
      <label title={p.canPrevious ? 'Log do container anterior (CrashLoop)' : 'Sem restarts'}>
        <input
          type="checkbox"
          checked={p.options.previous}
          disabled={!p.canPrevious}
          onChange={(e) => p.onOptions({ ...p.options, previous: e.target.checked })}
        />
        --previous
      </label>
      <button onClick={p.onReconnect} disabled={!p.status}>
        ↻ Reabrir
      </button>
      {p.dropped > 0 && (
        <span className="pill warn" title="Buffer cheio: as linhas mais antigas foram descartadas">
          {p.dropped.toLocaleString('pt-BR')} linhas descartadas
        </span>
      )}
      {p.status?.state === 'error' && p.status.message && <span className="error-text">{p.status.message}</span>}
      <span className="spacer" />
      <button onClick={p.onShell} disabled={!p.canShell} title="Abre um terminal no container (ação manual)">
        ⌨ Abrir shell
      </button>
      <button onClick={p.onAiPreferences} title="Provedor de IA para explicar erros">
        ⚙ IA
      </button>
    </div>
  )
}
