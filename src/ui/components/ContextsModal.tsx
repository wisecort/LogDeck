import { useState } from 'react'
import { contextLabel, deleteContextCommand } from '../context-view'
import type { Navigation } from '../useNavigation'
import { IconCopy } from './icons'

/** Show/hide contexts in LogDeck. Removing from the kubeconfig is left to the user's terminal (G1/G4). */
export function ContextsModal({ nav, onClose }: { nav: Navigation; onClose(): void }) {
  const [filter, setFilter] = useState('')
  const [copied, setCopied] = useState<string>()
  const list = nav.contexts.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()))
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Gerenciar contextos" onClick={onClose}>
      <div className="modal ctx-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Gerenciar contextos</h2>
        <p className="muted">
          Contextos ocultos somem do seletor só no LogDeck. O app nunca altera o seu kubeconfig: para remover de vez, copie o comando e rode no
          terminal.
        </p>
        {nav.contexts.length > 6 && (
          <input className="ns-input" aria-label="Filtrar contextos" placeholder="filtrar…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        )}
        <ul className="ctx-list">
          {list.map((c) => {
            const hidden = nav.hiddenContexts.includes(c.name)
            const l = contextLabel(c.name)
            return (
              <li key={c.name} className={hidden ? 'is-hidden' : ''} data-testid="ctx-row">
                <div className="ctx-name" title={c.name}>
                  <strong>{l.title}</strong>
                  {c.production && <span className="pill bad">PROD</span>}
                  {c.current && <span className="pill">atual</span>}
                  {l.subtitle && <div className="muted mono">{l.subtitle}</div>}
                </div>
                <button aria-label={`${hidden ? 'Mostrar' : 'Ocultar'} ${c.name}`} onClick={() => nav.toggleHidden(c.name)}>
                  {hidden ? 'Mostrar' : 'Ocultar'}
                </button>
                <button
                  className="icon-btn"
                  aria-label={`Copiar comando para remover ${c.name}`}
                  title={deleteContextCommand(c.name)}
                  onClick={() => {
                    void window.logdeck.copyText(deleteContextCommand(c.name))
                    setCopied(c.name)
                  }}
                >
                  <IconCopy /> {copied === c.name ? 'Copiado' : 'Comando para remover'}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="modal-actions">
          <span className="muted">
            {nav.hiddenContexts.length} oculto{nav.hiddenContexts.length === 1 ? '' : 's'}
          </span>
          <span className="spacer" />
          <button onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
