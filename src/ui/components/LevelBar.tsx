import { LEVELS, type Level } from '../../logs/types'
import { IconChart, IconDownload, IconStack, IconTerminal, IconToBottom, IconToTop, IconTrash, IconWrap } from './icons'

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
  onBottom(): void
  onClear(): void
  canShell: boolean
  onShell(): void
  paused: boolean
  pending: number
  live: boolean
  onFollow(): void
}

export function LevelBar(p: Props) {
  const allOn = p.levels.size === LEVELS.length
  return (
    <div className="levelbar">
      <div role="group" aria-label="Níveis" style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <button className={`level-pill ${allOn ? 'on' : 'off'}`} aria-pressed={allOn} onClick={p.onAll}>
          Todos
        </button>
        {LEVELS.map((l) => (
          <button
            key={l}
            className={`level-pill ${p.levels.has(l) ? 'on' : 'off'}`}
            aria-pressed={p.levels.has(l)}
            title="Clique alterna; ⌥+clique mostra só este nível"
            onClick={(e) => p.onToggle(l, e.altKey)}
          >
            <span className={`dot lvl-${l}`} />
            {l} <span className="count">{p.counts[l] > 999 ? '999+' : p.counts[l]}</span>
          </button>
        ))}
      </div>
      <span className="spacer" />
      <button className="icon-btn" aria-label="Volume de logs" aria-pressed={p.showVolume} title="Volume de logs" onClick={p.onVolume}>
        <IconChart />
      </button>
      <button className="icon-btn" aria-label="Colapsar repetidas" aria-pressed={p.collapse} title="Colapsar linhas repetidas (×N)" onClick={p.onCollapse}>
        <IconStack />
      </button>
      <button className="icon-btn" aria-label="Quebrar linhas" aria-pressed={p.wrap} title="Quebrar linhas longas" onClick={p.onWrap}>
        <IconWrap />
      </button>
      <button className="icon-btn" aria-label="Exportar" title="Exportar as linhas filtradas" onClick={p.onExport}>
        <IconDownload />
      </button>
      <button className="icon-btn" aria-label="Ir para o topo" title="Topo" onClick={p.onTop}>
        <IconToTop />
      </button>
      <button className="icon-btn" aria-label="Ir para o fim" title="Fim" onClick={p.onBottom}>
        <IconToBottom />
      </button>
      <button className="icon-btn" aria-label="Limpar tela" title="Limpar as linhas exibidas (o log continua)" onClick={p.onClear}>
        <IconTrash />
      </button>
      <button className="icon-btn" aria-label="Abrir shell" title="Abre um terminal no container (ação manual)" disabled={!p.canShell} onClick={p.onShell}>
        <IconTerminal />
      </button>
      <button
        className={`follow-pill ${p.paused ? 'paused' : 'live'}`}
        data-testid="follow-pill"
        disabled={!p.live}
        onClick={p.onFollow}
        title={p.paused ? 'Retomar e ir para o fim' : 'Pausar a exibição (o buffer continua)'}
      >
        ● {p.paused ? `Pausado${p.pending > 0 ? ` · +${p.pending}` : ''}` : 'Seguindo'}
      </button>
    </div>
  )
}
