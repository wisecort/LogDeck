import { useEffect, useState } from 'react'
import type { KeyServiceName } from '../../shared/ai'
import { OPENAI_PRESETS, type AiSettings, type AiStatus, type ProviderKind } from '../../shared/ai-settings'
import { useI18n, type MessageKey } from '../i18n'

const PROVIDERS: Array<{ id: ProviderKind; label: MessageKey | string; hint: MessageKey }> = [
  { id: 'none', label: 'aip.none', hint: 'aip.noneHint' },
  { id: 'claude-cli', label: 'Claude Code CLI', hint: 'aip.claudeHint' },
  { id: 'anthropic', label: 'ai.anthropic', hint: 'aip.anthropicHint' },
  { id: 'openai', label: 'aip.openai', hint: 'aip.openaiHint' },
]

function KeyField({ service, configured, onStatus }: { service: KeyServiceName; configured: boolean; onStatus(s: AiStatus): void }) {
  const { t } = useI18n()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string>()
  const save = async () => {
    try {
      onStatus(await window.logdeck.setAiKey(service, value.trim()))
      setValue('')
      setError(undefined)
    } catch (err) {
      setError((err as Error).message)
    }
  }
  return (
    <div className="key-field">
      <span>
        {t('aip.key')} {configured ? <strong className="ok-text">{t('aip.keyOk')}</strong> : <span className="muted">{t('aip.keyMissing')}</span>}
      </span>
      <input
        type="password"
        aria-label={t('aip.keyLabel')}
        placeholder={configured ? t('aip.keyReplace') : t('aip.keyPaste')}
        value={value}
        autoComplete="off"
        onChange={(e) => setValue(e.target.value)}
      />
      <button onClick={() => void save()} disabled={!value.trim()}>
        {t('aip.keySave')}
      </button>
      {configured && (
        <button onClick={() => void window.logdeck.deleteAiKey(service).then(onStatus)} title={t('aip.keyRemoveHint')}>
          {t('aip.keyRemove')}
        </button>
      )}
      {error && <span className="error-text">{error}</span>}
    </div>
  )
}

export function AiPreferences({ onClose }: { onClose(): void }) {
  const { t } = useI18n()
  const [status, setStatus] = useState<AiStatus>()
  const [draft, setDraft] = useState<AiSettings>()
  const [test, setTest] = useState<{ state: 'idle' | 'running' | 'ok' | 'error'; text?: string }>({ state: 'idle' })
  const [error, setError] = useState<string>()

  useEffect(() => {
    void window.logdeck.aiStatus().then((s) => {
      setStatus(s)
      setDraft(s.settings)
    })
  }, [])

  if (!status || !draft) return null

  const save = async () => {
    try {
      const s = await window.logdeck.setAiSettings(draft)
      setStatus(s)
      setDraft(s.settings)
      setError(undefined)
      return true
    } catch (err) {
      setError((err as Error).message)
      return false
    }
  }

  const runTest = async () => {
    if (!(await save())) return
    setTest({ state: 'running' })
    try {
      setTest({ state: 'ok', text: (await window.logdeck.testAi()).slice(0, 200) })
    } catch (err) {
      setTest({ state: 'error', text: (err as Error).message })
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('aip.title')}>
      <div className="modal">
        <h2>{t('aip.title')}</h2>
        <p className="muted">{t('aip.intro')}</p>
        <div role="radiogroup" aria-label={t('aip.provider')}>
          {PROVIDERS.map((p) => (
            <label key={p.id} className="provider-option">
              <input type="radio" name="provider" checked={draft.provider === p.id} onChange={() => setDraft({ ...draft, provider: p.id })} />
              <span>
                <strong>{p.label.includes('.') ? t(p.label as MessageKey) : p.label}</strong>
                <span className="muted"> — {t(p.hint)}</span>
                {p.id === 'claude-cli' && (
                  <span className={status.claude.installed ? 'ok-text' : 'error-text'} data-testid="claude-status">
                    {' '}
                    {status.claude.installed ? `(${status.claude.version})` : `(${status.claude.message ?? t('aip.notFound')})`}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>

        {draft.provider === 'claude-cli' && (
          <label className="field">
            <span>{t('aip.claudeModel')}</span>
            <input aria-label={t('aip.claudeModelLabel')} value={draft.claudeModel} onChange={(e) => setDraft({ ...draft, claudeModel: e.target.value })} />
          </label>
        )}

        {draft.provider === 'anthropic' && (
          <>
            <label className="field">
              <span>{t('aip.model')}</span>
              <input aria-label={t('aip.anthropicModel')} value={draft.anthropicModel} onChange={(e) => setDraft({ ...draft, anthropicModel: e.target.value })} />
            </label>
            <KeyField service="logdeck-anthropic-api" configured={status.hasAnthropicKey} onStatus={setStatus} />
          </>
        )}

        {draft.provider === 'openai' && (
          <>
            <label className="field">
              <span>{t('aip.provider')}</span>
              <select
                aria-label={t('aip.preset')}
                value={draft.openai.preset}
                onChange={(e) => {
                  const preset = OPENAI_PRESETS.find((p) => p.id === e.target.value)!
                  setDraft({ ...draft, openai: { ...draft.openai, preset: preset.id, baseUrl: preset.baseUrl || draft.openai.baseUrl } })
                }}
              >
                {OPENAI_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id === 'custom' ? t('aip.custom') : p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('aip.baseUrl')}</span>
              <input aria-label={t('aip.baseUrlLabel')} value={draft.openai.baseUrl} onChange={(e) => setDraft({ ...draft, openai: { ...draft.openai, baseUrl: e.target.value } })} />
            </label>
            <label className="field">
              <span>{t('aip.model')}</span>
              <input
                aria-label={t('aip.model')}
                placeholder={t('aip.modelPh')}
                value={draft.openai.model}
                onChange={(e) => setDraft({ ...draft, openai: { ...draft.openai, model: e.target.value } })}
              />
            </label>
            <KeyField service="logdeck-openai-compatible-api" configured={status.hasOpenAiKey} onStatus={setStatus} />
          </>
        )}

        <label className="provider-option">
          <input type="checkbox" checked={draft.maskInternalIps} onChange={(e) => setDraft({ ...draft, maskInternalIps: e.target.checked })} />
          {t('aip.maskDefault')}
        </label>

        {error && <div className="error-text">{error}</div>}
        {test.state !== 'idle' && (
          <div className={test.state === 'error' ? 'error-text' : test.state === 'ok' ? 'ok-text' : 'muted'} data-testid="ai-test-result">
            {test.state === 'running' ? t('aip.testing') : test.state === 'ok' ? t('aip.testOk', { text: test.text ?? '' }) : test.text}
          </div>
        )}
        <div className="modal-actions">
          <button onClick={() => void runTest()} disabled={draft.provider === 'none' || test.state === 'running'} title={t('aip.testHint')}>
            {t('aip.test')}
          </button>
          <span className="spacer" />
          <button onClick={onClose}>{t('common.cancel')}</button>
          <button className="primary" onClick={() => void save().then((ok) => ok && onClose())}>
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
