import { useI18n } from '../i18n'
import { IconPause, IconPlay } from './icons'

interface Props {
  paused: boolean
  pending: number
  live: boolean
  onFollow(): void
}

/** Pause/resume and the live state, glued together; sits at the end of the top bar, next to Time. */
export function StreamControl(p: Props) {
  const { t } = useI18n()
  return (
    <div className="stream-ctl">
      <button
        className="icon-btn"
        aria-label={p.paused ? t('lv.resume') : t('lv.pause')}
        title={p.paused ? t('lv.pausedHint') : t('lv.liveHint')}
        disabled={!p.live}
        onClick={p.onFollow}
      >
        {p.paused ? <IconPlay /> : <IconPause />}
      </button>
      <button
        className={`follow-pill ${p.paused ? 'paused' : 'live'}`}
        data-testid="follow-pill"
        disabled={!p.live}
        onClick={p.onFollow}
        title={p.paused ? t('lv.pausedHint') : t('lv.liveHint')}
      >
        {p.paused ? (
          <>
            <IconPause /> {t('lv.paused')}
            {p.pending > 0 ? ` · +${p.pending}` : ''}
          </>
        ) : (
          <>
            {p.live && <span className="live-dot sm" />} {t('lv.live')}
          </>
        )}
      </button>
    </div>
  )
}
