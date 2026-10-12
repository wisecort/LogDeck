import { useState, type RefObject } from 'react'
import { BUILTIN_PRESETS, type NamespacePresets } from '../../shared/presets'

export interface SearchState {
  text: string
  regex: boolean
  caseSensitive: boolean
  exclude: string
}

interface Props {
  value: SearchState
  onChange(v: SearchState): void
  inputRef: RefObject<HTMLInputElement | null>
  error?: string
  matchCount: number
  total: number
  presets?: NamespacePresets
  onPresets(p: NamespacePresets): void
  collapse: boolean
  onCollapse(v: boolean): void
}

export function SearchBar({ inputRef, ...p }: Props) {
  const [saving, setSaving] = useState(false)
  const [presetName, setPresetName] = useState('')
  const all = [...BUILTIN_PRESETS, ...(p.presets?.presets ?? [])]

  const togglePreset = (id: string) => {
    if (!p.presets) return
    const active = p.presets.active.includes(id) ? p.presets.active.filter((a) => a !== id) : [...p.presets.active, id]
    p.onPresets({ ...p.presets, active })
  }

  const savePreset = () => {
    const terms = p.value.exclude
      .split(/[\n,]/)
      .map((t) => t.trim())
      .filter(Boolean)
    if (!p.presets || !presetName.trim() || terms.length === 0) return
    const slug = presetName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)
    const id = `p-${p.presets.presets.length + 1}-${slug}`
    p.onPresets({ presets: [...p.presets.presets, { id, name: presetName.trim(), terms }], active: [...p.presets.active, id] })
    p.onChange({ ...p.value, exclude: '' })
    setPresetName('')
    setSaving(false)
  }

  return (
    <div className="searchbar">
      <input
        ref={inputRef}
        className="search-input"
        aria-label="Buscar"
        placeholder={p.value.regex ? 'Regex (ex.: AH0107[15]|70007)' : 'Buscar (⌘F) — ex.: FPM, AH01075, timeout'}
        value={p.value.text}
        onChange={(e) => p.onChange({ ...p.value, text: e.target.value })}
      />
      <label title="Expressão regular">
        <input
          type="checkbox"
          aria-label="Expressão regular"
          checked={p.value.regex}
          onChange={(e) => p.onChange({ ...p.value, regex: e.target.checked })}
        />
        .*
      </label>
      <label title="Diferenciar maiúsculas">
        <input
          type="checkbox"
          aria-label="Diferenciar maiúsculas"
          checked={p.value.caseSensitive}
          onChange={(e) => p.onChange({ ...p.value, caseSensitive: e.target.checked })}
        />
        Aa
      </label>
      <input
        className="exclude-input"
        aria-label="Excluir"
        placeholder="Excluir (vírgula separa termos)"
        value={p.value.exclude}
        onChange={(e) => p.onChange({ ...p.value, exclude: e.target.value })}
      />
      {saving ? (
        <span className="preset-save">
          <input aria-label="Nome do preset" placeholder="Nome do preset" value={presetName} onChange={(e) => setPresetName(e.target.value)} />
          <button onClick={savePreset}>Salvar</button>
          <button onClick={() => setSaving(false)}>×</button>
        </span>
      ) : (
        <button onClick={() => setSaving(true)} disabled={!p.presets || !p.value.exclude.trim()} title="Salvar exclusões deste namespace">
          ☆ Salvar preset
        </button>
      )}
      <span className="presets" role="group" aria-label="Presets de exclusão">
        {all.map((preset) => (
          <button
            key={preset.id}
            className={`chip ${p.presets?.active.includes(preset.id) ? 'on' : ''}`}
            aria-pressed={p.presets?.active.includes(preset.id) ?? false}
            title={preset.terms.join(', ')}
            disabled={!p.presets}
            onClick={() => togglePreset(preset.id)}
          >
            {preset.name}
          </button>
        ))}
      </span>
      <label title="Agrupar linhas repetidas consecutivas">
        <input type="checkbox" aria-label="Colapsar repetidas" checked={p.collapse} onChange={(e) => p.onCollapse(e.target.checked)} />
        Colapsar repetidas
      </label>
      <span className="muted match-count" data-testid="match-count">
        {p.matchCount.toLocaleString('pt-BR')} / {p.total.toLocaleString('pt-BR')}
      </span>
      {p.error && <span className="error-text">{p.error}</span>}
    </div>
  )
}
