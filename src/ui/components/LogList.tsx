import { useVirtualizer } from '@tanstack/react-virtual'
import { memo, useEffect, useLayoutEffect, useRef } from 'react'
import { displayTime } from '../../logs/classify'
import type { Row } from '../../logs/collapse'
import { highlight, type CompiledSearch } from '../../logs/search'
import { formatDateTime, formatTime } from '../format'
import { IconBookmark } from './icons'

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
}

const LogRow = memo(function LogRow({ row, search, selected, cursor, bookmarked, wrap, onSelect, onBookmark }: RowProps) {
  const { entry } = row
  const t = displayTime(entry)
  const both = t.divergent ? `log: ${formatDateTime(entry.logTime)} · kubectl: ${formatDateTime(entry.k8sTime)}` : undefined
  return (
    <div
      className={`log-row lvl-${entry.level} ${selected ? 'selected' : ''} ${cursor ? 'cursor' : ''}`}
      data-testid="log-row"
      data-level={entry.level}
      aria-selected={selected}
      onClick={() => onSelect(entry.seq)}
    >
      <span className="time" title={both ?? (t.source === 'k8s' ? 'horário do kubectl (--timestamps)' : 'horário do log')}>
        {formatTime(t.time)}
        {t.divergent && <span className="diverge" aria-label="horários divergentes"> ⚠</span>}
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
      {!wrap && entry.continuation.length > 0 && <span className="more">+{entry.continuation.length} linhas</span>}
      <button
        className={`icon-btn row-mark ${bookmarked ? 'on' : ''}`}
        aria-label={bookmarked ? 'Desmarcar linha' : 'Marcar linha'}
        aria-pressed={bookmarked}
        onClick={(e) => {
          e.stopPropagation()
          onBookmark(entry.seq)
        }}
      >
        <IconBookmark filled={bookmarked} />
      </button>
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
}

export function LogList(p: Props) {
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
    <div className="log-wrap">
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
            return (
              <div
                key={item.key}
                data-index={item.index}
                ref={virtualizer.measureElement}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${item.start}px)` }}
              >
                <LogRow
                  row={row}
                  search={p.search}
                  selected={p.selectedSeq === row.entry.seq}
                  cursor={p.cursor === item.index}
                  bookmarked={p.bookmarks.has(row.entry.seq)}
                  wrap={p.wrap}
                  onSelect={p.onSelect}
                  onBookmark={p.onBookmark}
                />
              </div>
            )
          })}
        </div>
        {p.rows.length === 0 && <div className="empty muted">Nenhuma linha para os filtros atuais.</div>}
      </div>
      {p.paused && p.rows.length > 0 && (
        <button className="to-bottom" onClick={p.onResume}>
          ⤓ Seguir o fim
        </button>
      )}
    </div>
  )
}
