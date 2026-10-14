import { useVirtualizer } from '@tanstack/react-virtual'
import { memo, useEffect, useLayoutEffect, useRef } from 'react'
import { displayTime } from '../../logs/classify'
import type { Row } from '../../logs/collapse'
import { highlight, type CompiledSearch } from '../../logs/search'
import { formatDateTime, formatTime } from '../format'
import { useI18n } from '../i18n'
import { IconBookmark } from './icons'
import type { PlacedMarks } from '../../logs/marks'
import { DroppedLine, MarkLine } from './MarkLine'

export type ScrollCommand = { kind: 'top' | 'bottom' } | { kind: 'seq'; seq: number }

function Text({ text, search }: { text: string; search?: CompiledSearch }) {
  if (!search) return <>{text}</>
  // Plain segments only; React escapes them (G7).
  return (
    <>
      {highlight(text, search).map((s, i) => (s.match ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}
    </>
  )
}

interface RowProps {
  row: Row
  search?: CompiledSearch
  selected: boolean
  cursor: boolean
  bookmarked: boolean
  wrap: boolean
  onSelect(seq: number): void
  onBookmark(seq: number): void
  markable: boolean
}

const LogRow = memo(function LogRow({ row, search, selected, cursor, bookmarked, wrap, onSelect, onBookmark, markable }: RowProps) {
  const { t } = useI18n()
  const { entry } = row
  const time = displayTime(entry)
  const both = time.divergent ? t('log.both', { a: formatDateTime(entry.logTime), b: formatDateTime(entry.k8sTime) }) : undefined
  // HH:MM:SS stays bright, the milliseconds are dimmed so the eye lands on the second.
  const clock = formatTime(time.time)
  const dotAt = clock.lastIndexOf('.')
  return (
    <div
      className={`log-row lvl-${entry.level} ${selected ? 'selected' : ''} ${cursor ? 'cursor' : ''}`}
      data-testid="log-row"
      data-level={entry.level}
      aria-selected={selected}
      onClick={() => onSelect(entry.seq)}
    >
      <span className="time" title={both ?? (time.source === 'k8s' ? t('log.k8sTime') : t('log.logTime'))}>
        {dotAt > 0 ? (
          <>
            {clock.slice(0, dotAt)}
            <span className="ms">{clock.slice(dotAt)}</span>
          </>
        ) : (
          clock
        )}
        {time.divergent && <span className="diverge" aria-label={t('log.diverge')}> ⚠</span>}
      </span>
      <span className={`badge lvl-${entry.level}`}>{entry.level}</span>
      {row.count > 1 && (
        <span className="repeat" title={`${formatTime(row.firstTime)} → ${formatTime(row.lastTime)}`}>
          ×{row.count}
        </span>
      )}
      <span className="msg">
        <Text text={entry.raw} search={search} />
        {wrap &&
          entry.continuation.slice(0, 30).map((c, i) => (
            <span key={i} style={{ display: 'block', paddingLeft: 16 }} className="muted">
              <Text text={c} search={search} />
            </span>
          ))}
      </span>
      {!wrap && entry.continuation.length > 0 && <span className="more">{t('log.more', { n: entry.continuation.length })}</span>}
      {markable && (
      <button
        className={`icon-btn row-mark ${bookmarked ? 'on' : ''}`}
        aria-label={bookmarked ? t('log.unmark') : t('log.mark')}
        aria-pressed={bookmarked}
        onClick={(e) => {
          e.stopPropagation()
          onBookmark(entry.seq)
        }}
      >
        <IconBookmark filled={bookmarked} />
      </button>
      )}
    </div>
  )
})

interface Props {
  rows: Row[]
  search?: CompiledSearch
  cursor?: number
  selectedSeq?: number
  bookmarks: ReadonlySet<number>
  wrap: boolean
  paused: boolean
  command?: { cmd: ScrollCommand; nonce: number }
  onSelect(seq: number): void
  onBookmark(seq: number): void
  onUserScrollUp(): void
  onResume(): void
  /** false for the read-only --previous pane: no bookmark button. */
  markable?: boolean
  label?: string
  /** Stream drops, silences and restarts placed between rows. */
  marks?: PlacedMarks
  /** Lines dropped by the full buffer (banner above the oldest row) and the per-tab limit. */
  dropped?: { n: number; capacity: number }
  /** Live pod stream, not a file. */
  live?: boolean
  onPrevious?(): void
}

export function LogList(p: Props) {
  const { t } = useI18n()
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: p.rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 21,
    overscan: 30,
  })

  // tail -f: stick to the bottom while following.
  useLayoutEffect(() => {
    if (!p.paused && p.rows.length > 0) virtualizer.scrollToIndex(p.rows.length - 1, { align: 'end' })
  }, [p.rows, p.paused, virtualizer])

  useEffect(() => {
    if (p.cursor !== undefined && p.cursor < p.rows.length) virtualizer.scrollToIndex(p.cursor, { align: 'center' })
  }, [p.cursor, p.rows.length, virtualizer])

  useEffect(() => {
    if (!p.command) return
    const { cmd } = p.command
    if (cmd.kind === 'top') virtualizer.scrollToIndex(0, { align: 'start' })
    else if (cmd.kind === 'bottom') virtualizer.scrollToIndex(p.rows.length - 1, { align: 'end' })
    else {
      const target = 'seq' in cmd ? cmd.seq : -1
      const i = p.rows.findIndex((r) => r.entry.seq === target)
      if (i >= 0) virtualizer.scrollToIndex(i, { align: 'center' })
    }
  }, [p.command]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="log-wrap" aria-label={p.label}>
      <div
        ref={parentRef}
        className={`log-list ${p.wrap ? 'wrap' : ''}`}
        data-testid="log-list"
        onWheel={(e) => {
          if (e.deltaY < 0 && !p.paused) p.onUserScrollUp()
        }}
      >
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((item) => {
            const row = p.rows[item.index]!
            const above = p.marks?.before.get(item.index)
            const last = item.index === p.rows.length - 1
            return (
              <div
                key={item.key}
                data-index={item.index}
                ref={virtualizer.measureElement}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${item.start}px)` }}
              >
                {item.index === 0 && p.dropped && p.dropped.n > 0 && <DroppedLine n={p.dropped.n} capacity={p.dropped.capacity} />}
                {above?.map((m, i) => <MarkLine key={i} mark={m} live={p.live ?? false} {...(p.onPrevious && { onPrevious: p.onPrevious })} />)}
                <LogRow
                  row={row}
                  search={p.search}
                  selected={p.selectedSeq === row.entry.seq}
                  cursor={p.cursor === item.index}
                  bookmarked={p.bookmarks.has(row.entry.seq)}
                  wrap={p.wrap}
                  onSelect={p.onSelect}
                  onBookmark={p.onBookmark}
                  markable={p.markable ?? true}
                />
                {last && p.marks?.trailing.map((m, i) => <MarkLine key={i} mark={m} live={p.live ?? false} {...(p.onPrevious && { onPrevious: p.onPrevious })} />)}
              </div>
            )
          })}
        </div>
        {p.rows.length === 0 && <div className="empty muted">{t('log.empty')}</div>}
      </div>
      {p.paused && p.rows.length > 0 && (
        <button className="to-bottom" onClick={p.onResume}>
          {t('log.backToLive')}
        </button>
      )}
    </section>
  )
}
