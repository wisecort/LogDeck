import { useEffect, useState } from 'react'
import { displayTime } from '../../logs/classify'
import type { SignatureGroup } from '../../logs/signatures'
import type { LogEntry } from '../../logs/types'
import type { ExplainGroupInput, ExplainResult, PreviewResult } from '../../shared/ai'
import type { AiStatus } from '../../shared/ai-settings'
import { formatDateTime } from '../format'
import { useI18n, type Translate } from '../i18n'
import { groupTitle } from '../group-title'
import { ticketText, type TicketSource } from '../ticket'
import { AiAnswer } from './AiAnswer'
import { IconBookmark, IconCheckCircle, IconCopy, IconGear, IconRows, IconSparkle } from './icons'

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

export function aiLabel(t: Translate, s?: AiStatus): string {
  switch (s?.settings.provider) {
    case 'claude-cli':
      return `Claude Code CLI${s.settings.claudeModel ? ` · ${s.settings.claudeModel}` : ''}`
    case 'anthropic':
      return `${t('ai.anthropic')} · ${s.settings.anthropicModel}`
    case 'openai':
      return `${s.settings.openai.model || t('ai.modelMissing')} · ${s.settings.openai.baseUrl.replace(/^https?:\/\//, '')}`
    default:
      return t('ai.notConfigured')
  }
}

function ErrorsTab(p: Props) {
  const { t } = useI18n()
  return (
    <>
      <div className="errors-head">
      <button
        className="primary"
        disabled={p.selectedGroups.size === 0}
        onClick={() => {
          p.onAiMode('grupos')
          p.onTab('ia')
        }}
        title={p.selectedGroups.size === 0 ? t('err.pickOne') : t('err.openAi')}
      >
        {t('err.explain')}{p.selectedGroups.size > 0 ? ` (${p.selectedGroups.size})` : ''}
      </button>
      {p.activeGroup && (
        <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => p.onGroup(undefined)}>
          {t('err.clearGroup')}
        </button>
      )}
      </div>
      {p.groups.length === 0 && (
        <div className="empty-state tone-ok">
          <span className="empty-state-icon">
            <IconCheckCircle />
          </span>
          {t('err.none')}
        </div>
      )}
      <ul className="groups">
        {p.groups.map((g) => (
          <li key={g.key} className={`group ${p.activeGroup === g.key ? 'active' : ''}`} data-testid="error-group">
            <input type="checkbox" aria-label={t('err.select', { title: groupTitle(t, g) })} checked={p.selectedGroups.has(g.key)} onChange={() => p.onToggleGroup(g.key)} />
            <button className="group-body" onClick={() => p.onGroup(p.activeGroup === g.key ? undefined : g.key)} title={g.sample}>
              <span className="group-title">{groupTitle(t, g)}</span>
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

function ticketLabels(t: Translate) {
  return {
    file: t('ticket.file'),
    pod: t('ticket.pod'),
    context: t('ticket.context'),
    k8sTime: t('ticket.k8sTime'),
    logTime: t('ticket.logTime'),
    level: t('ticket.level'),
  }
}

function TicketButton({ entry, source }: { entry: LogEntry; source: TicketSource }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState<number>()
  return (
    <button
      className="icon-btn"
      title={t('det.ticketHint')}
      onClick={() => {
        void window.logdeck.copyText(ticketText(entry, source, ticketLabels(t)))
        setCopied(entry.seq)
      }}
    >
      <IconCopy /> {copied === entry.seq ? t('common.copied') : t('det.ticket')}
    </button>
  )
}

function DetailsTab(p: Props) {
  const { t } = useI18n()
  const e = p.entry
  if (!e)
    return (
      <div className="empty-state">
        <span className="empty-state-icon">
          <IconRows />
        </span>
        {t('det.empty')}
      </div>
    )
  const time = displayTime(e)
  const json = prettyJson(e.raw)
  const full = [e.raw, ...e.continuation].join('\n')
  return (
    <div data-testid="log-details" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="det-head">
        <div className="det-head-row">
          <span className={`badge lvl-${e.level}`}>{e.level}</span>
          <span className="mono">{formatDateTime(time.time)}</span>
          <span className="spacer" />
          <span className="muted mono" style={{ fontSize: 11 }}>
            {e.parser}
          </span>
        </div>
        <div className="det-actions">
        <button className="icon-btn" aria-pressed={p.bookmarked} onClick={() => p.onBookmark(e.seq)}>
          <IconBookmark filled={p.bookmarked} /> {p.bookmarked ? t('det.marked') : t('det.mark')}
        </button>
        <button
          className="icon-btn"
          onClick={() => {
            p.onAiMode('linha')
            p.onTab('ia')
          }}
        >
          <IconSparkle /> {t('det.askAi')}
        </button>
        </div>
      </div>
      <dl className="kv">
        <dt>{t('det.format')}</dt>
        <dd>{e.parser}</dd>
        <dt>{t('det.logTime')}</dt>
        <dd>{e.logTime !== undefined ? formatDateTime(e.logTime) : '—'}</dd>
        <dt>{t('det.k8sTime')}</dt>
        <dd>{e.k8sTime !== undefined ? formatDateTime(e.k8sTime) : '—'}</dd>
        {time.divergent && (
          <>
            <dt>{t('det.warning')}</dt>
            <dd className="error-text">{t('det.diverge')}</dd>
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
        {t('det.line')} <span className="spacer" />
        <button className="icon-btn" onClick={() => void window.logdeck.copyText(full)}>
          <IconCopy /> {t('common.copy')}
        </button>
        <TicketButton entry={e} source={p.ticketSource} />
      </div>
      <pre className="code-box">{e.raw}</pre>
      {e.continuation.length > 0 && (
        <>
          <div className="panel-section-title">{t('det.stack', { n: e.continuation.length })}</div>
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
  const { t, n } = useI18n()
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
          {aiLabel(t, p.aiStatus)}
        </span>
        <span className="spacer" />
        <button className="icon-btn" aria-label={t('ai.configure')} onClick={p.onAiPreferences}>
          <IconGear />
        </button>
      </div>

      {!configured && (
        <div className="destination remote" style={{ marginTop: 10 }}>
          {t('ai.noProvider')}{' '}
          <button className="link" onClick={p.onAiPreferences}>
            {t('ai.configure')}
          </button>
        </div>
      )}

      {configured && (phase.name === 'compose' || phase.name === 'loading') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          <div className="panel-section-title">{t('ai.whatToSend')}</div>
          <div className="ai-context" role="radiogroup" aria-label={t('ai.contextLabel')}>
            <label>
              <input type="radio" name="ai-ctx" checked={p.aiMode === 'linha'} disabled={!canUse('linha')} onChange={() => p.onAiMode('linha')} />
              {t('ai.ctxLine')}
            </label>
            <label>
              <input type="radio" name="ai-ctx" checked={p.aiMode === 'grupos'} disabled={!canUse('grupos')} onChange={() => p.onAiMode('grupos')} />
              {t('ai.ctxGroups', { n: p.selectedGroups.size })}
            </label>
            <label>
              <input type="radio" name="ai-ctx" checked={p.aiMode === 'visiveis'} disabled={!canUse('visiveis')} onChange={() => p.onAiMode('visiveis')} />
              {t('ai.ctxVisible', { n: n(p.visibleCount) })}
            </label>
          </div>
          <textarea
            className="ai-question"
            aria-label={t('ai.question')}
            placeholder={t('ai.questionPh')}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <label className="provider-option">
            <input type="checkbox" checked={mask} onChange={(e) => setMask(e.target.checked)} />
            {t('ai.maskIps')}
          </label>
          {error && (
            <div className="error-text" data-testid="ai-error">
              {error}
            </div>
          )}
          <button className="primary" disabled={!canUse(p.aiMode) || phase.name === 'loading'} onClick={() => void prepare()}>
            {phase.name === 'loading' ? t('ai.preparing') : t('ai.prepare')}
          </button>
          <div className="muted" style={{ fontSize: 12 }}>
            {t('ai.previewNote')}
          </div>
        </div>
      )}

      {(phase.name === 'preview' || phase.name === 'sending') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          <div className={`destination ${phase.preview.local ? 'local' : 'remote'}`} data-testid="ai-destination">
            {t('ai.destination')} <strong>{phase.preview.destination}</strong>
            {!phase.preview.local && <div className="muted">{t('ai.remoteNote')}</div>}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            {t('ai.stats', { lines: phase.preview.lines, kb: (phase.preview.bytes / 1024).toFixed(1), n: phase.preview.redactions })}
            {phase.preview.truncated && t('ai.truncated')}
          </div>
          {phase.preview.question && <div className="turn-question">{phase.preview.question}</div>}
          <label className="provider-option">
            <input
              type="checkbox"
              aria-label={t('ai.maskIps')}
              checked={mask}
              disabled={phase.name === 'sending'}
              onChange={(e) => {
                setMask(e.target.checked)
                void prepare(e.target.checked)
              }}
            />
            {t('ai.maskIps')}
          </label>
          <pre className="code-box" data-testid="ai-preview">
            {phase.preview.text}
          </pre>
          <div className="modal-actions">
            <button onClick={() => setPhase({ name: 'compose' })} disabled={phase.name === 'sending'}>
              {t('common.back')}
            </button>
            <span className="spacer" />
            <button className="primary" disabled={phase.name === 'sending'} onClick={() => void send(phase.preview)}>
              {phase.name === 'sending' ? t('ai.analyzing', { s: elapsed }) : t('common.send')}
            </button>
          </div>
        </div>
      )}

      {phase.name === 'conversation' && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10, flex: 1 }}>
            {turns.map((turn, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {turn.question && <div className="turn-question">{turn.question}</div>}
                {turn.result && <AiAnswer result={turn.result} />}
                {turn.error && <div className="error-text">{turn.error}</div>}
                {!turn.result && !turn.error && <div className="muted">{t('ai.analyzing', { s: elapsed })}</div>}
              </div>
            ))}
            <button className="link" onClick={reset} style={{ alignSelf: 'flex-start' }}>
              {t('ai.newAnalysis')}
            </button>
          </div>
          <div className="ai-follow" style={{ margin: '10px -10px -10px' }}>
            <input
              aria-label={t('ai.askMore')}
              placeholder={t('ai.askMorePh')}
              value={followUp}
              disabled={busy}
              onChange={(e) => setFollowUp(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void ask()
              }}
            />
            <button className="primary" disabled={busy || !followUp.trim()} onClick={() => void ask()}>
              {t('ai.sendQuestion')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/** Right column (block A): errors, entry details and AI. Tabs stay mounted to keep the AI conversation. */
export function RightPanel(p: Props) {
  const { t } = useI18n()
  const tabs: Array<[PanelTab, string]> = [
    ['erros', t('rp.errors', { n: p.groups.length })],
    ['detalhes', t('rp.details')],
    ['ia', t('rp.ai')],
  ]
  return (
    <aside className="panel" aria-label={t('rp.panel')}>
      <div className="tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" className="tab" aria-selected={p.tab === id} onClick={() => p.onTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="panel-body" role="tabpanel" hidden={p.tab !== 'erros'} aria-label={t('rp.errorsLabel')}>
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
