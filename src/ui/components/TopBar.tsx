import { useEffect, useRef, useState, type RefObject } from 'react'
import { BUILTIN_PRESETS, type NamespacePresets } from '../../shared/presets'
import { formatTime } from '../format'
import { useI18n } from '../i18n'
import { IconBan, IconClock, IconSearch, IconX } from './icons'

export interface SearchState {
  text: string
  regex: boolean
  caseSensitive: boolean
  exclude: string
}

export type { LogOptions } from '../view-types'
import type { LogOptions } from '../view-types'

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
  const { t } = useI18n()
  const [open, setOpen] = useState<'time' | 'presets' | undefined>()
  const [presetName, setPresetName] = useState('')
  const presetsRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)

  // An open popover closes on a click outside it or on Escape, so it never covers the toolbar.
  useEffect(() => {
    if (!open) return
    const wrap = open === 'presets' ? presetsRef : timeRef
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(undefined)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(undefined)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
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
          aria-label={t('top.search')}
          placeholder={p.search.regex ? t('top.regexPh') : t('top.searchPh')}
          value={p.search.text}
          onChange={(e) => p.onSearch({ ...p.search, text: e.target.value })}
        />
        {p.search.text && p.matchCount !== undefined && <span className="search-count">{p.matchCount}</span>}
        <button
          className="icon-btn mono"
          aria-label={t('top.case')}
          aria-pressed={p.search.caseSensitive}
          title={t('top.case')}
          onClick={() => p.onSearch({ ...p.search, caseSensitive: !p.search.caseSensitive })}
        >
          Aa
        </button>
        <button
          className="icon-btn mono"
          aria-label={t('top.regex')}
          aria-pressed={p.search.regex}
          title={t('top.regex')}
          onClick={() => p.onSearch({ ...p.search, regex: !p.search.regex })}
        >
          .*
        </button>
      </div>
      <div className="search-box exclude-box">
        <IconBan />
        <input
          aria-label={t('top.exclude')}
          placeholder={t('top.excludePh')}
          value={p.search.exclude}
          onChange={(e) => p.onSearch({ ...p.search, exclude: e.target.value })}
        />
      </div>

      <div className="popover-wrap" ref={presetsRef}>
        <button className="icon-btn" aria-expanded={open === 'presets'} onClick={() => setOpen(open === 'presets' ? undefined : 'presets')}>
          {t('top.presets')}{activeCount > 0 ? ` (${activeCount})` : ''} ▾
        </button>
        {open === 'presets' && (
          <div className="popover">
            <div className="muted">{t('top.presetsHelp')}</div>
            <div role="group" aria-label={t('top.presetsGroup')}>
              {all.map((preset) => (
                <button
                  key={preset.id}
                  className={`chip ${p.presets?.active.includes(preset.id) ? 'on' : ''}`}
                  aria-pressed={p.presets?.active.includes(preset.id) ?? false}
                  title={preset.terms.join(', ')}
                  disabled={!p.presets}
                  onClick={() => togglePreset(preset.id)}
                >
                  {preset.builtin ? t(`preset.${preset.id}` as 'preset.health-checks') : preset.name}
                </button>
              ))}
            </div>
            <label>
              <input aria-label={t('top.presetName')} placeholder={t('top.presetNamePh')} value={presetName} onChange={(e) => setPresetName(e.target.value)} />
              <button onClick={savePreset} disabled={!p.presets || !presetName.trim() || !p.search.exclude.trim()}>
                {t('common.save')}
              </button>
            </label>
          </div>
        )}
      </div>

      <div className="popover-wrap" ref={timeRef}>
        <button className="icon-btn" aria-expanded={open === 'time'} onClick={() => setOpen(open === 'time' ? undefined : 'time')}>
          <IconClock /> {t('top.time')}
        </button>
        {open === 'time' && (
          <div className="popover">
            <label>
              {t('top.tail')}
              <select aria-label="tail" value={p.options.tail} onChange={(e) => p.onOptions({ ...p.options, tail: Number(e.target.value) })}>
                {[100, 1000, 5000, 20000, -1].map((n) => (
                  <option key={n} value={n}>
                    {n === -1 ? t('top.all') : n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('top.since')}
              <select aria-label="since" value={p.options.since} onChange={(e) => p.onOptions({ ...p.options, since: e.target.value })}>
                {['', '5m', '15m', '1h', '6h', '24h'].map((s) => (
                  <option key={s} value={s}>
                    {s || '—'}
                  </option>
                ))}
              </select>
            </label>
            <label title={p.canPrevious ? t('top.previousHint') : t('top.noRestarts')}>
              <span>
                <input
                  type="checkbox"
                  aria-label="--previous"
                  checked={p.options.previous}
                  disabled={!p.canPrevious}
                  onChange={(e) => p.onOptions({ ...p.options, previous: e.target.checked })}
                />{' '}
                {t('top.previous')}
              </span>
            </label>
            <button onClick={p.onReconnect} disabled={!p.canReconnect}>
              {t('top.reopen')}
            </button>
          </div>
        )}
      </div>

      {p.timeRange && (
        <span className="filter-chip">
          {formatTime(p.timeRange[0])} → {formatTime(p.timeRange[1])}
          <button className="icon-btn" aria-label={t('top.clearRange')} onClick={p.onClearTimeRange}>
            <IconX />
          </button>
        </span>
      )}
      {p.error && <span className="error-text">{p.error}</span>}
      {p.filtersActive && (
        <button className="link" onClick={p.onClearFilters}>
          {t('top.clearFilters')}
        </button>
      )}
    </div>
  )
}
