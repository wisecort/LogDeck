import { LEVELS, type Level } from '../../logs/types'

interface Props {
  counts: Readonly<Record<Level, number>>
  levels: ReadonlySet<Level>
  onToggle(level: Level, solo: boolean): void
}

export function LevelFilter({ counts, levels, onToggle }: Props) {
  return (
    <div className="levels" role="group" aria-label="Níveis">
      {LEVELS.map((l) => (
        <button
          key={l}
          className={`level-chip lvl-${l} ${levels.has(l) ? 'on' : 'off'}`}
          aria-pressed={levels.has(l)}
          title="Clique alterna; ⌥+clique mostra só este nível"
          onClick={(e) => onToggle(l, e.altKey)}
        >
          {l} <span className="count">{counts[l] > 999 ? '999+' : counts[l]}</span>
        </button>
      ))}
    </div>
  )
}
