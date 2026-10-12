import { useEffect, useState } from 'react'
import { displayTime } from '../../logs/classify'
import type { SignatureGroup } from '../../logs/signatures'
import type { LogEntry } from '../../logs/types'
import type { ExplainGroupInput, ExplainResult, PreviewResult } from '../../shared/ai'
import type { AiStatus } from '../../shared/ai-settings'
import { formatDateTime } from '../format'
import { ticketText, type TicketSource } from '../ticket'
import { AiAnswer } from './AiAnswer'
import { IconBookmark, IconCopy, IconGear, IconSparkle } from './icons'

export type PanelTab = 'erros' | 'detalhes' | 'ia'
export type AiContextMode = 'linha' | 'grupos' | 'visiveis'

interface Props {
  tab: PanelTab
  onTab(t: PanelTab): void
  groups: SignatureGroup[]
  activeGroup?: string
  onGroup(key: string | undefined): void
  selectedGroups: ReadonlySet<string>
  onToggleGroup(key: string): void
  entry?: LogEntry
  bookmarked: boolean
  onBookmark(seq: number): void
  visibleCount: number
  aiStatus?: AiStatus
  aiMode: AiContextMode
  onAiMode(m: AiContextMode): void
  buildContext(mode: AiContextMode): ExplainGroupInput[]
  onAiPreferences(): void
  ticketSource: TicketSource
}

export function aiLabel(s?: AiStatus): string {
  switch (s?.settings.provider) {
    case 'claude-cli':
      return `Claude Code CLI${s.settings.claudeModel ? ` · ${s.settings.claudeModel}` : ''}`
    case 'anthropic':
      return `API da Anthropic · ${s.settings.anthropicModel}`
    case 'openai':
      return `${s.settings.openai.model || 'modelo?'} · ${s.settings.openai.baseUrl.replace(/^https?:\/\//, '')}`
    default:
      return 'não configurada'
  }
}

function ErrorsTab(p: Props) {
  return (
    <>
      <button
        className="primary"
        disabled={p.selectedGroups.size === 0}
        onClick={() => {
          p.onAiMode('grupos')
          p.onTab('ia')
        }}
        title={p.selectedGroups.size === 0 ? 'Marque ao menos um grupo' : 'Abre a aba IA com estes grupos'}
      >
        ✨ Explicar esses erros{p.selectedGroups.size > 0 ? ` (${p.selectedGroups.size})` : ''}
      </button>
      {p.activeGroup && (
        <button className="link" onClick={() => p.onGroup(undefined)}>
          limpar filtro do grupo
        </button>
      )}
      {p.groups.length === 0 && <div className="muted">Nenhum erro agrupado até agora.</div>}
      <ul className="groups">
        {p.groups.map((g) => (
          <li key={g.key} className={`group ${p.activeGroup === g.key ? 'active' : ''}`} data-testid="error-group">
            <input type="checkbox" aria-label={`Selecionar ${g.title}`} checked={p.selectedGroups.has(g.key)} onChange={() => p.onToggleGroup(g.key)} />
            <button className="group-body" onClick={() => p.onGroup(p.activeGroup === g.key ? undefined : g.key)} title={g.sample}>
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
    </>
  )
}

function prettyJson(raw: string): string | undefined {
  if (!raw.trimStart().startsWith('{')) return undefined
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return undefined
  }
}

function TicketButton({ entry, source }: { entry: LogEntry; source: TicketSource }) {
  const [copied, setCopied] = useState<number>()
  return (
    <button
      className="icon-btn"
      title="Copia pod, horários (UTC), nível e a linha, com senhas e tokens mascarados"
      onClick={() => {
        void window.logdeck.copyText(ticketText(entry, source))
        setCopied(entry.seq)
      }}
    >
      <IconCopy /> {copied === entry.seq ? 'Copiado' : 'Copiar para chamado'}
    </button>
  )
}

function DetailsTab(p: Props) {
  const e = p.entry
  if (!e) return <div className="muted">Clique numa linha do log para ver os detalhes.</div>
  const t = displayTime(e)
  const json = prettyJson(e.raw)
  const full = [e.raw, ...e.continuation].join('\n')
  return (
    <div data-testid="log-details" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className={`badge lvl-${e.level}`}>{e.level}</span>
        <span className="mono">{formatDateTime(t.time)}</span>
        <span className="spacer" />
        <button className="icon-btn" aria-pressed={p.bookmarked} onClick={() => p.onBookmark(e.seq)}>
          <IconBookmark filled={p.bookmarked} /> {p.bookmarked ? 'Marcada' : 'Marcar'}
        </button>
        <button
          className="icon-btn"
          onClick={() => {
            p.onAiMode('linha')
            p.onTab('ia')
          }}
        >
          <IconSparkle /> Perguntar à IA
        </button>
      </div>
      <dl className="kv">
        <dt>Formato</dt>
        <dd>{e.parser}</dd>
        <dt>Horário do log</dt>
        <dd>{e.logTime !== undefined ? formatDateTime(e.logTime) : '—'}</dd>
        <dt>Horário kubectl</dt>
        <dd>{e.k8sTime !== undefined ? formatDateTime(e.k8sTime) : '—'}</dd>
        {t.divergent && (
          <>
            <dt>Atenção</dt>
            <dd className="error-text">horários divergem (fuso do app?)</dd>
          </>
        )}
        {Object.entries(e.fields ?? {}).map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt>{k}</dt>
            <dd>{String(v)}</dd>
          </div>
        ))}
      </dl>
      {json && (
        <>
          <div className="panel-section-title">JSON</div>
          <pre className="code-box">{json}</pre>
        </>
      )}
      <div className="panel-section-title">
        Linha <span className="spacer" />
        <button className="icon-btn" onClick={() => void window.logdeck.copyText(full)}>
          <IconCopy /> Copiar
        </button>
        <TicketButton entry={e} source={p.ticketSource} />
      </div>
      <pre className="code-box">{e.raw}</pre>
      {e.continuation.length > 0 && (
        <>
          <div className="panel-section-title">Stack trace ({e.continuation.length} linhas)</div>
          <pre className="code-box">{e.continuation.join('\n')}</pre>
        </>
      )}
    </div>
  )
}

type Phase =
  | { name: 'compose' }
  | { name: 'loading' }
  | { name: 'preview'; preview: PreviewResult }
  | { name: 'sending'; preview: PreviewResult }
  | { name: 'conversation' }

interface Turn {
  question?: string
  result?: ExplainResult
  error?: string
}

function AiTab(p: Props) {
  const [phase, setPhase] = useState<Phase>({ name: 'compose' })
  const [question, setQuestion] = useState('')
  const [mask, setMask] = useState(p.aiStatus?.settings.maskInternalIps ?? false)
  const [error, setError] = useState<string>()
  const [turns, setTurns] = useState<Turn[]>([])
  const [conversationId, setConversationId] = useState<string>()
  const [followUp, setFollowUp] = useState('')
  const [busy, setBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!busy) return
    const t0 = Date.now()
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 500)
    return () => clearInterval(timer)
  }, [busy])

  const configured = p.aiStatus && p.aiStatus.settings.provider !== 'none'
  const canUse = (m: AiContextMode) => (m === 'linha' ? !!p.entry : m === 'grupos' ? p.selectedGroups.size > 0 : p.visibleCount > 0)

  const prepare = async (withMask = mask) => {
    setError(undefined)
    setPhase({ name: 'loading' })
    try {
      const preview = await window.logdeck.previewExplain(p.buildContext(p.aiMode), { maskInternalIps: withMask, ...(question.trim() && { question }) })
      setPhase({ name: 'preview', preview })
    } catch (err) {
      setError((err as Error).message)
      setPhase({ name: 'compose' })
    }
  }

  const send = async (preview: PreviewResult) => {
    setPhase({ name: 'sending', preview })
    setBusy(true)
    try {
      const result = await window.logdeck.explain(preview.id)
      setConversationId(result.conversationId)
      setTurns([{ ...(preview.question && { question: preview.question }), result }])
      setPhase({ name: 'conversation' })
    } catch (err) {
      setError((err as Error).message)
      setPhase({ name: 'compose' })
    } finally {
      setBusy(false)
    }
  }

  const ask = async () => {
    const q = followUp.trim()
    if (!q || !conversationId) return
    setFollowUp('')
    setTurns((t) => [...t, { question: q }])
    setBusy(true)
    try {
      const result = await window.logdeck.followUp(conversationId, q)
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, result } : x)))
    } catch (err) {
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: (err as Error).message } : x)))
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setPhase({ name: 'compose' })
    setTurns([])
    setConversationId(undefined)
    setQuestion('')
    setError(undefined)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div className="ai-head">
        <IconSparkle />
        <strong>IA</strong>
        <span className="muted" style={{ fontSize: 12 }}>
          {aiLabel(p.aiStatus)}
        </span>
        <span className="spacer" />
        <button className="icon-btn" aria-label="Configurar IA" onClick={p.onAiPreferences}>
          <IconGear />
        </button>
      </div>

      {!configured && (
        <div className="destination remote" style={{ marginTop: 10 }}>
          Nenhum provedor configurado.{' '}
          <button className="link" onClick={p.onAiPreferences}>
            Configurar IA
          </button>
        </div>
      )}

      {configured && (phase.name === 'compose' || phase.name === 'loading') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          <div className="panel-section-title">O que enviar</div>
          <div className="ai-context" role="radiogroup" aria-label="Contexto da IA">
            <label>
              <input type="radio" name="ai-ctx" checked={p.aiMode === 'linha'} disabled={!canUse('linha')} onChange={() => p.onAiMode('linha')} />
              Linha selecionada e as linhas ao redor
            </label>
            <label>
              <input type="radio" name="ai-ctx" checked={p.aiMode === 'grupos'} disabled={!canUse('grupos')} onChange={() => p.onAiMode('grupos')} />
              Grupos de erro marcados ({p.selectedGroups.size})
            </label>
            <label>
              <input type="radio" name="ai-ctx" checked={p.aiMode === 'visiveis'} disabled={!canUse('visiveis')} onChange={() => p.onAiMode('visiveis')} />
              Linhas visíveis no filtro (até 200 de {p.visibleCount.toLocaleString('pt-BR')})
            </label>
          </div>
          <textarea
            className="ai-question"
            aria-label="Pergunta para a IA"
            placeholder="O que você quer saber? (opcional) — ex.: por que começou às 3h?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <label className="provider-option">
            <input type="checkbox" checked={mask} onChange={(e) => setMask(e.target.checked)} />
            Mascarar IPs internos
          </label>
          {error && (
            <div className="error-text" data-testid="ai-error">
              {error}
            </div>
          )}
          <button className="primary" disabled={!canUse(p.aiMode) || phase.name === 'loading'} onClick={() => void prepare()}>
            {phase.name === 'loading' ? 'Preparando…' : 'Preparar envio'}
          </button>
          <div className="muted" style={{ fontSize: 12 }}>
            Você vê o texto mascarado e o destino antes de qualquer envio.
          </div>
        </div>
      )}

      {(phase.name === 'preview' || phase.name === 'sending') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          <div className={`destination ${phase.preview.local ? 'local' : 'remote'}`} data-testid="ai-destination">
            Será enviado para: <strong>{phase.preview.destination}</strong>
            {!phase.preview.local && <div className="muted">O texto abaixo será processado por esse provedor.</div>}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            {phase.preview.lines} linhas · {(phase.preview.bytes / 1024).toFixed(1)} KB · {phase.preview.redactions} valores mascarados
            {phase.preview.truncated && ' · limitado a 200 linhas / 32 KB'}
          </div>
          {phase.preview.question && <div className="turn-question">{phase.preview.question}</div>}
          <label className="provider-option">
            <input
              type="checkbox"
              aria-label="Mascarar IPs internos"
              checked={mask}
              disabled={phase.name === 'sending'}
              onChange={(e) => {
                setMask(e.target.checked)
                void prepare(e.target.checked)
              }}
            />
            Mascarar IPs internos
          </label>
          <pre className="code-box" data-testid="ai-preview">
            {phase.preview.text}
          </pre>
          <div className="modal-actions">
            <button onClick={() => setPhase({ name: 'compose' })} disabled={phase.name === 'sending'}>
              Voltar
            </button>
            <span className="spacer" />
            <button className="primary" disabled={phase.name === 'sending'} onClick={() => void send(phase.preview)}>
              {phase.name === 'sending' ? `Analisando… ${elapsed}s` : 'Enviar'}
            </button>
          </div>
        </div>
      )}

      {phase.name === 'conversation' && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10, flex: 1 }}>
            {turns.map((t, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {t.question && <div className="turn-question">{t.question}</div>}
                {t.result && <AiAnswer result={t.result} />}
                {t.error && <div className="error-text">{t.error}</div>}
                {!t.result && !t.error && <div className="muted">Analisando… {elapsed}s</div>}
              </div>
            ))}
            <button className="link" onClick={reset} style={{ alignSelf: 'flex-start' }}>
              Nova análise
            </button>
          </div>
          <div className="ai-follow" style={{ margin: '10px -10px -10px' }}>
            <input
              aria-label="Perguntar mais"
              placeholder="Perguntar mais…"
              value={followUp}
              disabled={busy}
              onChange={(e) => setFollowUp(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void ask()
              }}
            />
            <button className="primary" disabled={busy || !followUp.trim()} onClick={() => void ask()}>
              Enviar pergunta
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/** Right column (block A): errors, entry details and AI. Tabs stay mounted to keep the AI conversation. */
export function RightPanel(p: Props) {
  const tabs: Array<[PanelTab, string]> = [
    ['erros', `Erros (${p.groups.length})`],
    ['detalhes', 'Detalhes'],
    ['ia', 'IA'],
  ]
  return (
    <aside className="panel" aria-label="Painel">
      <div className="tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" className="tab" aria-selected={p.tab === id} onClick={() => p.onTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="panel-body" role="tabpanel" hidden={p.tab !== 'erros'} aria-label="Erros e timeouts">
        <ErrorsTab {...p} />
      </div>
      <div className="panel-body" role="tabpanel" hidden={p.tab !== 'detalhes'}>
        <DetailsTab {...p} />
      </div>
      <div className="panel-body" role="tabpanel" hidden={p.tab !== 'ia'}>
        <AiTab {...p} />
      </div>
    </aside>
  )
}
