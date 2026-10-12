import { useState, type RefObject } from 'react'
import { BUILTIN_PRESETS, type NamespacePresets } from '../../shared/presets'
import { formatTime } from '../format'
import { IconBan, IconClock, IconSearch, IconX } from './icons'

export interface SearchState {
  text: string
  regex: boolean
  caseSensitive: boolean
  exclude: string
}

export interface LogOptions {
  tail: number
  since: string
  previous: boolean
}

interface Props {
  search: SearchState
  onSearch(s: SearchState): void
  inputRef: RefObject<HTMLInputElement | null>
  matchCount?: number
  error?: string
  options: LogOptions
  onOptions(o: LogOptions): void
  canPrevious: boolean
  canReconnect: boolean
  onReconnect(): void
  presets?: NamespacePresets
  onPresets(p: NamespacePresets): void
  timeRange?: readonly [number, number]
  onClearTimeRange(): void
  filtersActive: boolean
  onClearFilters(): void
}

export function TopBar({ inputRef, ...p }: Props) {
  const [open, setOpen] = useState<'time' | 'presets' | undefined>()
  const [presetName, setPresetName] = useState('')
  const all = [...BUILTIN_PRESETS, ...(p.presets?.presets ?? [])]
  const activeCount = p.presets?.active.length ?? 0

  const togglePreset = (id: string) => {
    if (!p.presets) return
    const active = p.presets.active.includes(id) ? p.presets.active.filter((a) => a !== id) : [...p.presets.active, id]
    p.onPresets({ ...p.presets, active })
  }

  const savePreset = () => {
    const terms = p.search.exclude
      .split(/[\n,]/)
      .map((t) => t.trim())
      .filter(Boolean)
    if (!p.presets || !presetName.trim() || terms.length === 0) return
    const slug = presetName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)
    const id = `p-${p.presets.presets.length + 1}-${slug}`
    p.onPresets({ presets: [...p.presets.presets, { id, name: presetName.trim(), terms }], active: [...p.presets.active, id] })
    p.onSearch({ ...p.search, exclude: '' })
    setPresetName('')
  }

  return (
    <div className="topbar">
      <div className="search-box">
        <IconSearch />
        <input
          ref={inputRef}
          aria-label="Buscar"
          placeholder={p.search.regex ? 'Regex (ex.: AH0107[15]|70007)' : 'Buscar logs… (⌘F)'}
          value={p.search.text}
          onChange={(e) => p.onSearch({ ...p.search, text: e.target.value })}
        />
        {p.search.text && p.matchCount !== undefined && <span className="search-count">{p.matchCount}</span>}
        <button
          className="icon-btn mono"
          aria-label="Diferenciar maiúsculas"
          aria-pressed={p.search.caseSensitive}
          title="Diferenciar maiúsculas"
          onClick={() => p.onSearch({ ...p.search, caseSensitive: !p.search.caseSensitive })}
        >
          Aa
        </button>
        <button
          className="icon-btn mono"
          aria-label="Expressão regular"
          aria-pressed={p.search.regex}
          title="Expressão regular"
          onClick={() => p.onSearch({ ...p.search, regex: !p.search.regex })}
        >
          .*
        </button>
      </div>
      <div className="search-box exclude-box">
        <IconBan />
        <input
          aria-label="Excluir"
          placeholder="Excluir… (vírgula separa)"
          value={p.search.exclude}
          onChange={(e) => p.onSearch({ ...p.search, exclude: e.target.value })}
        />
      </div>

      <div className="popover-wrap">
        <button className="icon-btn" aria-expanded={open === 'presets'} onClick={() => setOpen(open === 'presets' ? undefined : 'presets')}>
          Presets{activeCount > 0 ? ` (${activeCount})` : ''} ▾
        </button>
        {open === 'presets' && (
          <div className="popover">
            <div className="muted">Exclusões salvas para este namespace</div>
            <div role="group" aria-label="Presets de exclusão">
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
            </div>
            <label>
              <input aria-label="Nome do preset" placeholder="Salvar exclusões atuais como…" value={presetName} onChange={(e) => setPresetName(e.target.value)} />
              <button onClick={savePreset} disabled={!p.presets || !presetName.trim() || !p.search.exclude.trim()}>
                Salvar
              </button>
            </label>
          </div>
        )}
      </div>

      <div className="popover-wrap">
        <button className="icon-btn" aria-expanded={open === 'time'} onClick={() => setOpen(open === 'time' ? undefined : 'time')}>
          <IconClock /> Tempo
        </button>
        {open === 'time' && (
          <div className="popover">
            <label>
              Últimas linhas (tail)
              <select aria-label="tail" value={p.options.tail} onChange={(e) => p.onOptions({ ...p.options, tail: Number(e.target.value) })}>
                {[100, 1000, 5000, 20000, -1].map((n) => (
                  <option key={n} value={n}>
                    {n === -1 ? 'tudo' : n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Desde
              <select aria-label="since" value={p.options.since} onChange={(e) => p.onOptions({ ...p.options, since: e.target.value })}>
                {['', '5m', '15m', '1h', '6h', '24h'].map((s) => (
                  <option key={s} value={s}>
                    {s || '—'}
                  </option>
                ))}
              </select>
            </label>
            <label title={p.canPrevious ? 'Log do container anterior (CrashLoop)' : 'Sem restarts'}>
              <span>
                <input
                  type="checkbox"
                  aria-label="--previous"
                  checked={p.options.previous}
                  disabled={!p.canPrevious}
                  onChange={(e) => p.onOptions({ ...p.options, previous: e.target.checked })}
                />{' '}
                Container anterior (--previous)
              </span>
            </label>
            <button onClick={p.onReconnect} disabled={!p.canReconnect}>
              Reabrir log
            </button>
          </div>
        )}
      </div>

      {p.timeRange && (
        <span className="filter-chip">
          {formatTime(p.timeRange[0])} → {formatTime(p.timeRange[1])}
          <button className="icon-btn" aria-label="Limpar intervalo" onClick={p.onClearTimeRange}>
            <IconX />
          </button>
        </span>
      )}
      {p.error && <span className="error-text">{p.error}</span>}
      {p.filtersActive && (
        <button className="link" onClick={p.onClearFilters}>
          Limpar filtros
        </button>
      )}
    </div>
  )
}
