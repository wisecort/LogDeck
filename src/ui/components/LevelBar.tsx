import { LEVELS, type Level } from '../../logs/types'
import { useI18n } from '../i18n'
import { IconChart, IconExport, IconStack, IconTerminal, IconToTop, IconTrash, IconWrap } from './icons'

interface Props {
  counts: Readonly<Record<Level, number>>
  levels: ReadonlySet<Level>
  onToggle(level: Level, solo: boolean): void
  onAll(): void
  showVolume: boolean
  onVolume(): void
  collapse: boolean
  onCollapse(): void
  wrap: boolean
  onWrap(): void
  onExport(): void
  onTop(): void
  onClear(): void
  canShell: boolean
  onShell(): void
  paused: boolean
  pending: number
  live: boolean
  onFollow(): void
}

export function LevelBar(p: Props) {
  const { t } = useI18n()
  const allOn = p.levels.size === LEVELS.length
  return (
    <div className="levelbar">
      <div role="group" aria-label={t('lv.levels')} style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <button className={`level-pill ${allOn ? 'on' : 'off'}`} aria-pressed={allOn} onClick={p.onAll}>
          {t('lv.all')}
        </button>
        {LEVELS.map((l) => (
          <button
            key={l}
            className={`level-pill ${p.levels.has(l) ? 'on' : 'off'}`}
            aria-pressed={p.levels.has(l)}
            title={t('lv.levelHint')}
            onClick={(e) => p.onToggle(l, e.altKey)}
          >
            <span className={`dot lvl-${l}`} />
            {l} <span className="count">{p.counts[l] > 999 ? '999+' : p.counts[l]}</span>
          </button>
        ))}
      </div>
      <span className="spacer" />
      <button className="icon-btn" aria-label={t('lv.volume')} aria-pressed={p.showVolume} title={t('lv.volume')} onClick={p.onVolume}>
        <IconChart />
      </button>
      <button className="icon-btn" aria-label={t('lv.collapse')} aria-pressed={p.collapse} title={t('lv.collapseHint')} onClick={p.onCollapse}>
        <IconStack />
      </button>
      <button className="icon-btn" aria-label={t('lv.wrap')} aria-pressed={p.wrap} title={t('lv.wrapHint')} onClick={p.onWrap}>
        <IconWrap />
      </button>
      <button className="icon-btn" aria-label={t('lv.export')} title={t('lv.exportHint')} onClick={p.onExport}>
        <IconExport />
      </button>
      <button className="icon-btn" aria-label={t('lv.top')} title={t('lv.top')} onClick={p.onTop}>
        <IconToTop />
      </button>
      <button className="icon-btn" aria-label={t('lv.clear')} title={t('lv.clearHint')} onClick={p.onClear}>
        <IconTrash />
      </button>
      <button className="icon-btn labeled" aria-label={t('lv.terminalLabel')} title={t('lv.terminalHint')} disabled={!p.canShell} onClick={p.onShell}>
        <IconTerminal /> {t('lv.terminal')}
      </button>
      <button
        className={`follow-pill ${p.paused ? 'paused' : 'live'}`}
        data-testid="follow-pill"
        disabled={!p.live}
        onClick={p.onFollow}
        title={p.paused ? t('lv.pausedHint') : t('lv.liveHint')}
      >
        {p.paused ? `❚❚ ${t('lv.paused')}${p.pending > 0 ? ` · +${p.pending}` : ''}` : `● ${t('lv.live')}`}
      </button>
    </div>
  )
}
