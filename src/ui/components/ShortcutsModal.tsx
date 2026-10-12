const KEYS: Array<[string, string]> = [
  ['⌘ O', 'Abrir arquivo de log (ou arraste para a janela)'],
  ['⌘ F', 'Buscar'],
  ['⌘ G / ⇧ ⌘ G', 'Próxima / anterior linha encontrada'],
  ['⌥ + clique no nível', 'Mostrar só aquele nível'],
  ['Esc', 'Limpar seleção / fechar'],
  ['?', 'Esta lista de atalhos'],
]

export function ShortcutsModal({ onClose }: { onClose(): void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Atalhos" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Atalhos</h2>
        <div className="shortcuts">
          {KEYS.map(([k, d]) => (
            <div key={k} style={{ display: 'contents' }}>
              <span>
                <kbd>{k}</kbd>
              </span>
              <span>{d}</span>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <span className="spacer" />
          <button onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
