import type { Mark } from '../../logs/marks'
import { formatTime } from '../format'
import { useI18n, type Translate } from '../i18n'
import { formatDuration } from '../pod-status'
import { runText } from './PodTab'

const clock = (ms: number) => formatTime(ms).slice(0, 8)

/** One-line description of a mark (also the histogram tooltip). */
export function markTitle(t: Translate, m: Mark): string {
  switch (m.kind) {
    case 'reconnect':
      return m.backAt !== undefined ? t('mark.reconnect', { lost: clock(m.lostAt), back: clock(m.backAt) }) : t('mark.reconnecting', { lost: clock(m.lostAt) })
    case 'quiet':
      return t('mark.quiet', { d: formatDuration(m.to - m.from) })
    case 'restart':
      return t('mark.restart', { name: m.container })
  }
}

function detail(t: Translate, m: Mark, live: boolean): string {
  switch (m.kind) {
    case 'reconnect':
      return m.backAt !== undefined ? t('mark.reconnectHint') : t('mark.reconnectingHint')
    case 'quiet':
      return `${clock(m.from)} → ${clock(m.to)}${live ? ` · ${t('mark.quietHint')}` : ''}`
    case 'restart':
      return `${t('mark.restartAt', { time: clock(m.time) })} · ${runText(t, { ...(m.reason && { reason: m.reason }), ...(m.exitCode !== undefined && { exitCode: m.exitCode }), ...(m.ranMs !== undefined && { startedAt: m.time - m.ranMs, finishedAt: m.time }) })}`
  }
}

const ICON: Record<Mark['kind'], string> = { reconnect: '⇢', quiet: '…', restart: '↻' }

interface Props {
  mark: Mark
  /** Live pod stream (not a file): silence means the container wrote nothing. */
  live: boolean
  onPrevious?(): void
}

/** A line between log rows saying what happened there: stream drop, silence or container restart. */
export function MarkLine({ mark, live, onPrevious }: Props) {
  const { t } = useI18n()
  return (
    <div className={`mark-line mark-${mark.kind}`} data-testid="log-mark" data-kind={mark.kind} role="note">
      <span className="mark-icon" aria-hidden="true">
        {ICON[mark.kind]}
      </span>
      <span className="mark-title">{markTitle(t, mark)}</span>
      <span className="mark-detail">{detail(t, mark, live)}</span>
      {mark.kind === 'restart' && onPrevious && (
        <button className="mark-action" onClick={onPrevious}>
          {t('mark.previous')}
        </button>
      )}
    </div>
  )
}

/** Banner above the oldest line when the tab's buffer dropped lines. */
export function DroppedLine({ n, capacity }: { n: number; capacity: number }) {
  const { t, n: num } = useI18n()
  return (
    <div className="mark-line mark-dropped" data-testid="log-mark" data-kind="dropped" role="note">
      <span className="mark-icon" aria-hidden="true">
        ▲
      </span>
      <span className="mark-title">{t('mark.dropped', { n: num(n) })}</span>
      <span className="mark-detail">{t('mark.droppedHint', { cap: num(capacity) })}</span>
    </div>
  )
}
