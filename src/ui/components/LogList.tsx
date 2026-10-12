import { useVirtualizer } from '@tanstack/react-virtual'
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { displayTime } from '../../logs/classify'
import type { Row } from '../../logs/collapse'
import { highlight, type CompiledSearch } from '../../logs/search'
import { formatDateTime, formatTime } from '../format'

const MAX_CONTINUATION = 30

function Text({ text, search }: { text: string; search?: CompiledSearch }) {
  if (!search) return <>{text}</>
  // Plain segments only; React escapes them (G7).
  return (
    <>
      {highlight(text, search).map((s, i) =>
        s.match ? (
          <mark key={i}>{s.text}</mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  )
}

const LogRow = memo(function LogRow({ row, search }: { row: Row; search?: CompiledSearch }) {
  const { entry } = row
  const t = displayTime(entry)
  const both = t.divergent ? `log: ${formatDateTime(entry.logTime)} · kubectl: ${formatDateTime(entry.k8sTime)}` : undefined
  return (
    <div className={`log-row lvl-${entry.level}`} data-testid="log-row" data-level={entry.level}>
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
        {entry.continuation.slice(0, MAX_CONTINUATION).map((c, i) => (
          <span key={i} className="cont">
            <Text text={c} search={search} />
          </span>
        ))}
        {entry.continuation.length > MAX_CONTINUATION && (
          <span className="cont muted">… +{entry.continuation.length - MAX_CONTINUATION} linhas</span>
        )}
      </span>
    </div>
  )
})

interface Props {
  rows: Row[]
  search?: CompiledSearch
  /** Index to scroll to (⌘G navigation). */
  cursor?: number
}

export function LogList({ rows, search, cursor }: Props) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [follow, setFollow] = useState(true)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 22,
    overscan: 30,
  })

  // Tail -f behaviour: stick to the bottom unless the user scrolled up.
  useLayoutEffect(() => {
    if (follow && rows.length > 0) virtualizer.scrollToIndex(rows.length - 1, { align: 'end' })
  }, [rows, follow, virtualizer])

  useEffect(() => {
    if (cursor !== undefined && cursor < rows.length) {
      setFollow(false)
      virtualizer.scrollToIndex(cursor, { align: 'center' })
    }
  }, [cursor, rows.length, virtualizer])

  const onScroll = () => {
    const el = parentRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    if (atBottom !== follow) setFollow(atBottom)
  }

  return (
    <div className="log-wrap">
      <div ref={parentRef} className="log-list" onScroll={onScroll} data-testid="log-list">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((item) => (
            <div
              key={item.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className={cursor === item.index ? 'cursor' : undefined}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${item.start}px)` }}
            >
              <LogRow row={rows[item.index]!} search={search} />
            </div>
          ))}
        </div>
        {rows.length === 0 && <div className="empty muted">Nenhuma linha para os filtros atuais.</div>}
      </div>
      {!follow && rows.length > 0 && (
        <button className="to-bottom" onClick={() => setFollow(true)}>
          ⤓ Ir para o fim
        </button>
      )}
    </div>
  )
}
