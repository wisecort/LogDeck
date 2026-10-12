import type { SignatureGroup } from '../../logs/signatures'
import { formatDateTime } from '../format'

interface Props {
  groups: SignatureGroup[]
  activeKey?: string
  onSelect(key: string | undefined): void
  selected: ReadonlySet<string>
  onToggleSelected(key: string): void
  onExplain(): void
}

export function ErrorsPanel({ groups, activeKey, onSelect, selected, onToggleSelected, onExplain }: Props) {
  return (
    <aside className="errors" aria-label="Erros e timeouts">
      <div className="section-title">
        Erros e timeouts <span className="muted">({groups.length})</span>
        {activeKey && (
          <button className="link" onClick={() => onSelect(undefined)}>
            limpar filtro
          </button>
        )}
      </div>
      <button
        className="explain-btn"
        disabled={selected.size === 0}
        onClick={onExplain}
        title={selected.size === 0 ? 'Marque ao menos um grupo' : 'Mostra o preview mascarado antes de enviar'}
      >
        ✨ Explicar esses erros{selected.size > 0 ? ` (${selected.size})` : ''}
      </button>
      {groups.length === 0 && <div className="muted">Nenhum erro agrupado até agora.</div>}
      <ul>
        {groups.map((g) => (
          <li key={g.key} className={`group ${activeKey === g.key ? 'active' : ''}`} data-testid="error-group">
            <input
              type="checkbox"
              aria-label={`Selecionar ${g.title}`}
              checked={selected.has(g.key)}
              onChange={() => onToggleSelected(g.key)}
            />
            <button className="group-body" onClick={() => onSelect(activeKey === g.key ? undefined : g.key)} title={g.sample}>
              <span className="group-title">{g.title}</span>
              <span className="group-meta">
                <span className="pill bad">{g.count}×</span>
                <span className="muted">
                  {formatDateTime(g.firstTime)} → {formatDateTime(g.lastTime)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
