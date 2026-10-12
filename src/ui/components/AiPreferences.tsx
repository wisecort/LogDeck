import { useEffect, useState } from 'react'
import type { KeyServiceName } from '../../shared/ai'
import { OPENAI_PRESETS, type AiSettings, type AiStatus, type ProviderKind } from '../../shared/ai-settings'

const PROVIDERS: Array<{ id: ProviderKind; label: string; hint: string }> = [
  { id: 'none', label: 'Nenhum', hint: 'O botão "Explicar esses erros" fica desabilitado.' },
  { id: 'claude-cli', label: 'Claude Code CLI', hint: 'Usa o seu login no Claude Code. Com assinatura (Pro/Max), sem cobrança por chamada.' },
  { id: 'anthropic', label: 'API da Anthropic', hint: 'Cobrada por token, à parte da assinatura. Chave no Keychain.' },
  { id: 'openai', label: 'API compatível com OpenAI', hint: 'Ollama/LM Studio (local, grátis), DeepSeek, OpenRouter, Groq ou URL própria.' },
]

function KeyField({ service, configured, onStatus }: { service: KeyServiceName; configured: boolean; onStatus(s: AiStatus): void }) {
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
      <span>Chave: {configured ? <strong className="ok-text">configurada no Keychain ✓</strong> : <span className="muted">não configurada</span>}</span>
      <input
        type="password"
        aria-label="Chave da API"
        placeholder={configured ? 'Colar nova chave para substituir' : 'Colar a chave'}
        value={value}
        autoComplete="off"
        onChange={(e) => setValue(e.target.value)}
      />
      <button onClick={() => void save()} disabled={!value.trim()}>
        Salvar chave
      </button>
      {configured && (
        <button onClick={() => void window.logdeck.deleteAiKey(service).then(onStatus)} title="Remove o item do Keychain">
          Remover chave
        </button>
      )}
      {error && <span className="error-text">{error}</span>}
    </div>
  )
}

export function AiPreferences({ onClose }: { onClose(): void }) {
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
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Preferências de IA">
      <div className="modal">
        <h2>Preferências de IA</h2>
        <p className="muted">Usada só pelo botão "Explicar esses erros", sempre com preview mascarado e confirmação.</p>
        <div role="radiogroup" aria-label="Provedor">
          {PROVIDERS.map((p) => (
            <label key={p.id} className="provider-option">
              <input type="radio" name="provider" checked={draft.provider === p.id} onChange={() => setDraft({ ...draft, provider: p.id })} />
              <span>
                <strong>{p.label}</strong>
                <span className="muted"> — {p.hint}</span>
                {p.id === 'claude-cli' && (
                  <span className={status.claude.installed ? 'ok-text' : 'error-text'} data-testid="claude-status">
                    {' '}
                    {status.claude.installed ? `(${status.claude.version})` : `(${status.claude.message ?? 'não encontrado'})`}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>

        {draft.provider === 'claude-cli' && (
          <label className="field">
            <span>Modelo (vazio = padrão do Claude Code)</span>
            <input aria-label="Modelo do Claude Code" value={draft.claudeModel} onChange={(e) => setDraft({ ...draft, claudeModel: e.target.value })} />
          </label>
        )}

        {draft.provider === 'anthropic' && (
          <>
            <label className="field">
              <span>Modelo</span>
              <input aria-label="Modelo da Anthropic" value={draft.anthropicModel} onChange={(e) => setDraft({ ...draft, anthropicModel: e.target.value })} />
            </label>
            <KeyField service="logdeck-anthropic-api" configured={status.hasAnthropicKey} onStatus={setStatus} />
          </>
        )}

        {draft.provider === 'openai' && (
          <>
            <label className="field">
              <span>Provedor</span>
              <select
                aria-label="Atalho do provedor"
                value={draft.openai.preset}
                onChange={(e) => {
                  const preset = OPENAI_PRESETS.find((p) => p.id === e.target.value)!
                  setDraft({ ...draft, openai: { ...draft.openai, preset: preset.id, baseUrl: preset.baseUrl || draft.openai.baseUrl } })
                }}
              >
                {OPENAI_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>URL base (HTTPS, ou HTTP só para localhost)</span>
              <input aria-label="URL base" value={draft.openai.baseUrl} onChange={(e) => setDraft({ ...draft, openai: { ...draft.openai, baseUrl: e.target.value } })} />
            </label>
            <label className="field">
              <span>Modelo</span>
              <input
                aria-label="Modelo"
                placeholder="ex.: llama3.1, deepseek-chat"
                value={draft.openai.model}
                onChange={(e) => setDraft({ ...draft, openai: { ...draft.openai, model: e.target.value } })}
              />
            </label>
            <KeyField service="logdeck-openai-compatible-api" configured={status.hasOpenAiKey} onStatus={setStatus} />
          </>
        )}

        <label className="provider-option">
          <input type="checkbox" checked={draft.maskInternalIps} onChange={(e) => setDraft({ ...draft, maskInternalIps: e.target.checked })} />
          Mascarar IPs internos por padrão
        </label>

        {error && <div className="error-text">{error}</div>}
        {test.state !== 'idle' && (
          <div className={test.state === 'error' ? 'error-text' : test.state === 'ok' ? 'ok-text' : 'muted'} data-testid="ai-test-result">
            {test.state === 'running' ? 'Testando…' : test.state === 'ok' ? `Provedor respondeu: ${test.text}` : test.text}
          </div>
        )}
        <div className="modal-actions">
          <button onClick={() => void runTest()} disabled={draft.provider === 'none' || test.state === 'running'} title='Envia só "Responda apenas OK", sem logs'>
            Testar provedor
          </button>
          <span className="spacer" />
          <button onClick={onClose}>Cancelar</button>
          <button className="primary" onClick={() => void save().then((ok) => ok && onClose())}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
