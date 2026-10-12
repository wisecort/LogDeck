import { useMemo, useRef, useState } from 'react'
import { LEVELS } from '../../logs/types'
import type { LogEntry } from '../../logs/types'
import { formatTime } from '../format'
import { buildVolume } from '../volume'
import { IconX } from './icons'

const BUCKETS = 60
// Stack order: worst on top.
const STACK = [...LEVELS].reverse()

interface Props {
  entries: LogEntry[]
  range?: readonly [number, number]
  onRange(range: [number, number]): void
  onClose(): void
}

/** Log volume per level over time (block D); drag to filter a time range. */
export function VolumeChart({ entries, range, onRange, onClose }: Props) {
  const v = useMemo(() => buildVolume(entries, BUCKETS), [entries])
  const barsRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number>()
  const [drag, setDrag] = useState<[number, number]>()

  const indexAt = (clientX: number) => {
    const rect = barsRef.current!.getBoundingClientRect()
    return Math.max(0, Math.min(v.buckets.length - 1, Math.floor(((clientX - rect.left) / rect.width) * v.buckets.length)))
  }

  const finish = () => {
    if (!drag) return
    const [a, b] = drag[0] <= drag[1] ? drag : [drag[1], drag[0]]
    onRange([v.buckets[a]!.from, v.buckets[b]!.from + v.bucketMs - 1])
    setDrag(undefined)
  }

  const inRange = (i: number) => {
    const b = v.buckets[i]!
    return range !== undefined && b.from + v.bucketMs > range[0] && b.from <= range[1]
  }

  const hb = hover !== undefined ? v.buckets[hover] : undefined
  return (
    <div className="volume" data-testid="volume">
      <div className="volume-head">
        Volume de logs — {entries.length.toLocaleString('pt-BR')} linhas
        <span className="spacer" />
        <span className="muted" style={{ textTransform: 'none' }}>
          arraste para filtrar um intervalo
        </span>
        <button className="icon-btn" aria-label="Fechar volume" onClick={onClose}>
          <IconX />
        </button>
      </div>
      {v.buckets.length === 0 ? (
        <div className="muted" style={{ height: 64 }}>
          Sem linhas com horário.
        </div>
      ) : (
        <>
          <div
            ref={barsRef}
            className="volume-bars"
            onMouseMove={(e) => {
              const i = indexAt(e.clientX)
              setHover(i)
              if (drag) setDrag([drag[0], i])
            }}
            onMouseLeave={() => {
              setHover(undefined)
              finish()
            }}
            onMouseDown={(e) => {
              const i = indexAt(e.clientX)
              setDrag([i, i])
            }}
            onMouseUp={finish}
          >
            {v.buckets.map((b, i) => (
              <div key={i} className={`volume-bar ${inRange(i) ? 'in-range' : ''}`} style={{ height: `${v.max ? (b.total / v.max) * 100 : 0}%` }}>
                {STACK.filter((l) => b.counts[l] > 0)
                  .reverse()
                  .map((l) => (
                    <span key={l} style={{ flex: b.counts[l], background: `var(--lvl-${l === 'FATAL' ? 'FATAL-bg' : l})` }} />
                  ))}
              </div>
            ))}
            {drag && (
              <div
                className="volume-select"
                style={{
                  left: `${(Math.min(...drag) / v.buckets.length) * 100}%`,
                  width: `${((Math.abs(drag[1] - drag[0]) + 1) / v.buckets.length) * 100}%`,
                }}
              />
            )}
            {hb && hover !== undefined && (
              <div className="volume-tip" style={{ left: `${((hover + 0.5) / v.buckets.length) * 100}%` }}>
                {hb.total} linhas · {formatTime(hb.from)}
                {hb.counts.ERROR + hb.counts.FATAL > 0 && <span className="error-text"> · {hb.counts.ERROR + hb.counts.FATAL} erros</span>}
              </div>
            )}
          </div>
          <div className="volume-axis">
            <span>{formatTime(v.start)}</span>
            <span>{formatTime(v.end)}</span>
          </div>
        </>
      )}
    </div>
  )
}
