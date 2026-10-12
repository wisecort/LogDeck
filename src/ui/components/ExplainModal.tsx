import { useEffect, useState } from 'react'
import type { ExplainGroupInput, ExplainResult, PreviewResult, ResponseBlock } from '../../shared/ai'

type Phase =
  | { name: 'loading' }
  | { name: 'preview'; preview: PreviewResult }
  | { name: 'sending'; preview: PreviewResult }
  | { name: 'result'; result: ExplainResult }
  | { name: 'error'; message: string }

function TextBlock({ content }: { content: string }) {
  // Plain text only (G7): headings and bullets are styled, nothing is parsed as HTML.
  return (
    <div className="ai-text">
      {content.split('\n').map((line, i) =>
        line.startsWith('#') ? (
          <h4 key={i}>{line.replace(/^#+\s*/, '')}</h4>
        ) : (
          <p key={i}>{line}</p>
        ),
      )}
    </div>
  )
}

function CodeBlock({ block, dangerous }: { block: ResponseBlock; dangerous: readonly string[] }) {
  const lines = block.content.split('\n')
  const risky = lines.some((l) => dangerous.some((d) => l.includes(d)))
  return (
    <div className="ai-code">
      <pre>
        {lines.map((l, i) => (
          <span key={i} className={dangerous.some((d) => l.includes(d)) ? 'write-cmd' : undefined}>
            {l}
            {'\n'}
          </span>
        ))}
      </pre>
      {!risky && (
        <button onClick={() => void navigator.clipboard.writeText(block.content)} title="Copiar comandos de leitura">
          Copiar
        </button>
      )}
    </div>
  )
}

function DiffBlock({ block }: { block: ResponseBlock }) {
  const [saved, setSaved] = useState<string>()
  const ext = block.lang === 'yaml' || block.lang === 'yml' ? 'yaml' : 'diff'
  return (
    <div className="ai-diff" data-testid="ai-diff">
      <div className="muted">Sugestão para revisão — nunca é aplicada no cluster.</div>
      <pre>
        {block.content.split('\n').map((l, i) => (
          <span key={i} className={l.startsWith('+') ? 'add' : l.startsWith('-') ? 'del' : undefined}>
            {l}
            {'\n'}
          </span>
        ))}
      </pre>
      <button onClick={() => void window.logdeck.saveSuggestion(block.content, `logdeck-sugestao.${ext}`).then((p) => p && setSaved(p))}>
        Salvar em arquivo…
      </button>
      {saved && <span className="muted"> salvo em {saved}</span>}
    </div>
  )
}

export function ExplainModal({ groups, maskDefault, onClose }: { groups: ExplainGroupInput[]; maskDefault: boolean; onClose(): void }) {
  const [mask, setMask] = useState(maskDefault)
  const [phase, setPhase] = useState<Phase>({ name: 'loading' })

  useEffect(() => {
    let alive = true
    window.logdeck
      .previewExplain(groups, { maskInternalIps: mask })
      .then((preview) => alive && setPhase({ name: 'preview', preview }))
      .catch((err: Error) => alive && setPhase({ name: 'error', message: err.message }))
    return () => {
      alive = false
    }
  }, [groups, mask])

  const send = async (preview: PreviewResult) => {
    setPhase({ name: 'sending', preview })
    try {
      setPhase({ name: 'result', result: await window.logdeck.explain(preview.id) })
    } catch (err) {
      setPhase({ name: 'error', message: (err as Error).message })
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Explicar esses erros">
      <div className="modal wide">
        <h2>Explicar esses erros</h2>
        {phase.name === 'loading' && <p className="muted">Preparando o preview mascarado…</p>}
        {phase.name === 'error' && <p className="error-text" data-testid="ai-error">{phase.message}</p>}

        {(phase.name === 'preview' || phase.name === 'sending') && (
          <>
            <div className={`destination ${phase.preview.local ? 'local' : 'remote'}`} data-testid="ai-destination">
              Será enviado para: <strong>{phase.preview.destination}</strong>
              {!phase.preview.local && <span> — o conteúdo abaixo será processado por esse provedor.</span>}
            </div>
            <div className="muted">
              {phase.preview.lines} linhas · {(phase.preview.bytes / 1024).toFixed(1)} KB · {phase.preview.redactions} valores mascarados
              {phase.preview.truncated && ' · limitado a 200 linhas / 32 KB (as mais recentes de cada grupo)'}
            </div>
            <label className="provider-option">
              <input type="checkbox" checked={mask} disabled={phase.name === 'sending'} onChange={(e) => setMask(e.target.checked)} />
              Mascarar IPs internos
            </label>
            <pre className="preview" data-testid="ai-preview">
              {phase.preview.text}
            </pre>
          </>
        )}

        {phase.name === 'result' && (
          <div className="ai-result" data-testid="ai-result">
            {phase.result.writeCommands.length > 0 && (
              <div className="warn-box" data-testid="ai-write-warning">
                ⚠ A resposta sugere comandos que <strong>alteram o cluster</strong>. O LogDeck é somente leitura e não os executa:
                <ul>
                  {phase.result.writeCommands.map((c) => (
                    <li key={c}>
                      <code>{c}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {phase.result.blocks.map((b, i) =>
              b.type === 'text' ? (
                <TextBlock key={i} content={b.content} />
              ) : b.type === 'diff' ? (
                <DiffBlock key={i} block={b} />
              ) : (
                <CodeBlock key={i} block={b} dangerous={phase.result.writeCommands} />
              ),
            )}
          </div>
        )}

        <div className="modal-actions">
          <span className="spacer" />
          <button onClick={onClose}>{phase.name === 'result' ? 'Fechar' : 'Cancelar'}</button>
          {(phase.name === 'preview' || phase.name === 'sending') && (
            <button className="primary" disabled={phase.name === 'sending'} onClick={() => void send(phase.preview)}>
              {phase.name === 'sending' ? 'Enviando…' : 'Enviar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
