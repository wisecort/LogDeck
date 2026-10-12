import { useState } from 'react'
import { formatAge } from '../../k8s/pods'
import type { LogEntry } from '../../logs/types'
import type { PodInfo } from '../../shared/ipc'
import { contextLabel } from '../context-view'
import { ContextsModal } from './ContextsModal'
import { formatTime } from '../format'
import { THEMES, type ThemeId } from '../theme'
import { nsKey, type Navigation } from '../useNavigation'
import { IconBookmark, IconChevron, IconFile, IconGear, IconKeyboard, IconStar, IconTerminal, IconX } from './icons'

export interface Selection {
  context?: string
  namespace?: string
  pod?: PodInfo
  container?: string
}

interface Props {
  nav: Navigation
  selection: Selection
  onPod(context: string, namespace: string, pod: PodInfo): void
  onContainer(name: string): void
  bookmarks: LogEntry[]
  onBookmark(seq: number): void
  shellOpen: boolean
  onCloseShell(): void
  now: number
  theme: ThemeId
  onTheme(t: ThemeId): void
  onAiPreferences(): void
  onShortcuts(): void
  onOpenFile(): void
  fileName?: string
}

const MANAGE = '__manage__'

function podDot(status: string): string {
  if (status === 'Running' || status === 'Completed') return 'ok'
  if (/BackOff|Error|Failed|OOM|Init:|Terminating/.test(status)) return 'bad'
  return 'warn'
}

export function Sidebar(p: Props) {
  const { nav, selection } = p
  const [managing, setManaging] = useState(false)
  const [podFilter, setPodFilter] = useState('')
  const q = podFilter.trim().toLowerCase()
  const active = nav.contexts.find((c) => c.name === nav.activeContext)
  const activeNs = active ? nav.namespaces[active.name] : undefined
  const isFav = (c: string, n: string) => nav.favorites.some((f) => f.context === c && f.namespace === n)

  const renderPods = (context: string, namespace: string) => {
    const list = nav.pods[nsKey(context, namespace)]
    if (!list) return nav.loading.has(`ns:${nsKey(context, namespace)}`) ? <li className="muted node">carregando…</li> : null
    if (list.length === 0) return <li className="muted node">nenhum pod</li>
    const shown = q && !namespace.toLowerCase().includes(q) ? list.filter((pod) => pod.name.toLowerCase().includes(q)) : list
    if (shown.length === 0) return <li className="muted node">nenhum pod com “{podFilter.trim()}”</li>
    return shown.map((pod) => {
      const selected = selection.context === context && selection.namespace === namespace && selection.pod?.name === pod.name
      const containers = [...pod.containers, ...pod.initContainers]
      return (
        <li key={pod.name}>
          <button
            className={`node ${selected ? 'selected' : ''}`}
            onClick={() => p.onPod(context, namespace, pod)}
            title={`${pod.name}\n${pod.status} · ${pod.ready} prontos · ${pod.restarts} restarts`}
          >
            <span className={`dot ${podDot(pod.status)}`} />
            <span className="node-label mono">{pod.name}</span>
            {pod.restarts > 0 && <span className="node-meta">↻{pod.restarts}</span>}
            {pod.createdAt !== undefined && <span className="node-meta">{formatAge(p.now - pod.createdAt)}</span>}
          </button>
          {selected && containers.length > 1 && (
            <ul role="group" aria-label="Containers">
              {containers.map((c) => (
                <li key={c}>
                  <button className={`node ${selection.container === c ? 'selected' : ''}`} onClick={() => p.onContainer(c)}>
                    <span className="node-label mono">{c}</span>
                    {pod.initContainers.includes(c) && <span className="node-meta">init</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </li>
      )
    })
  }

  /** A namespace stays visible when its name or one of its loaded pods matches the search. */
  const nsMatches = (context: string, namespace: string) =>
    !q || namespace.toLowerCase().includes(q) || (nav.pods[nsKey(context, namespace)] ?? []).some((pod) => pod.name.toLowerCase().includes(q))

  const renderNamespace = (context: string, namespace: string) => {
    const key = nsKey(context, namespace)
    const podHit = !!q && !namespace.toLowerCase().includes(q) && (nav.pods[key] ?? []).some((pod) => pod.name.toLowerCase().includes(q))
    const open = nav.expanded.has(`ns:${key}`) || podHit
    return (
      <li key={namespace}>
        <div className="node" style={{ padding: 0 }}>
          <button className="node" aria-expanded={open} onClick={() => void nav.openNamespace(context, namespace)}>
            <IconChevron open={open} />
            <span className="node-label">{namespace}</span>
          </button>
          <button
            className={`icon-btn star-btn ${isFav(context, namespace) ? 'on' : ''}`}
            aria-label={`Favoritar ${namespace}`}
            aria-pressed={isFav(context, namespace)}
            onClick={() => nav.toggleFavorite(context, namespace)}
          >
            <IconStar filled={isFav(context, namespace)} />
          </button>
        </div>
        {open && <ul>{renderPods(context, namespace)}</ul>}
      </li>
    )
  }

  return (
    <aside className="sidebar">
      <div className={`ctx-picker ${active?.production ? 'prod' : ''}`}>
        <label className="ctx-picker-label" htmlFor="ctx-select">
          Contexto
          {active?.production && <span className="pill bad">PROD</span>}
        </label>
        <select
          id="ctx-select"
          aria-label="Contexto"
          value={active?.name ?? ''}
          disabled={nav.contexts.length === 0}
          title={active?.name}
          onChange={(e) => (e.target.value === MANAGE ? setManaging(true) : nav.selectContext(e.target.value))}
        >
          {nav.visible.map((c) => {
            const l = contextLabel(c.name)
            return (
              <option key={c.name} value={c.name} title={c.name}>
                {l.title}
                {l.subtitle && ` (${l.subtitle})`}
                {c.production ? ' — PROD' : ''}
                {c.current ? ' • atual' : ''}
              </option>
            )
          })}
          <option disabled>──────────</option>
          <option value={MANAGE}>Gerenciar contextos…</option>
        </select>
        {managing && <ContextsModal nav={nav} onClose={() => setManaging(false)} />}
      </div>
      <nav className="sidebar-scroll" aria-label="Navegação">
        {nav.favorites.length > 0 && (
          <>
            <div className="section-label">
              <IconStar /> Favoritos
            </div>
            <ul className="tree">
              {nav.favorites.map((f) => (
                <li key={nsKey(f.context, f.namespace)}>
                  <button className="node" onClick={() => void nav.openNamespace(f.context, f.namespace, true)} title={f.context}>
                    <span className="node-label">{f.namespace}</span>
                    <span className="node-meta">{f.context.split('/')[0]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="section-label">Namespaces</div>
        {active && (
          <input
            className="ns-input pod-filter"
            type="search"
            aria-label="Procurar pod ou namespace"
            placeholder="Procurar pod ou namespace…"
            title="Procura nos nomes de namespaces e nos pods dos namespaces já abertos"
            value={podFilter}
            onChange={(e) => setPodFilter(e.target.value)}
          />
        )}
        {!active && <p className="muted node">nenhum contexto no kubeconfig</p>}
        {active && (
          <ul className="tree" aria-label="Namespaces">
            {!activeNs && <li className="muted node">carregando…</li>}
            {activeNs?.namespaces.filter((n) => nsMatches(active.name, n)).map((n) => renderNamespace(active.name, n))}
            {activeNs && !activeNs.canList && (
              <li>
                <input
                  className="ns-input"
                  aria-label={`Outro namespace em ${active.name}`}
                  placeholder="sem permissão para listar; digite e Enter"
                  onKeyDown={(e) => {
                    const v = (e.target as HTMLInputElement).value.trim()
                    if (e.key === 'Enter' && v) {
                      nav.addNamespace(active.name, v)
                      void nav.openNamespace(active.name, v, true)
                    }
                  }}
                />
              </li>
            )}
          </ul>
        )}

        <div className="section-label">Arquivo</div>
        <ul className="tree">
          <li>
            <button className="node" onClick={p.onOpenFile} title="Abrir um log salvo (⌘ O) ou arraste o arquivo para a janela">
              <IconFile />
              <span className="node-label">Abrir arquivo de log…</span>
              <kbd>⌘O</kbd>
            </button>
          </li>
          {p.fileName && (
            <li>
              <div className="node selected" title={p.fileName}>
                <span className="node-label mono">{p.fileName}</span>
              </div>
            </li>
          )}
        </ul>

        {p.shellOpen && selection.pod && (
          <>
            <div className="section-label">Shells</div>
            <ul className="tree">
              <li>
                <div className="node">
                  <IconTerminal />
                  <span className="node-label mono">
                    {selection.pod.name}/{selection.container}
                  </span>
                  <button className="icon-btn" aria-label="Fechar shell" onClick={p.onCloseShell}>
                    <IconX />
                  </button>
                </div>
              </li>
            </ul>
          </>
        )}

        {p.bookmarks.length > 0 && (
          <>
            <div className="section-label">
              <IconBookmark /> Marcadas ({p.bookmarks.length})
            </div>
            <ul className="tree" aria-label="Linhas marcadas">
              {p.bookmarks.map((e) => (
                <li key={e.seq}>
                  <button className="node" onClick={() => p.onBookmark(e.seq)} title={e.raw}>
                    <span className={`dot lvl-${e.level}`} />
                    <span className="node-meta">{formatTime(e.logTime ?? e.k8sTime)}</span>
                    <span className="node-label mono">{e.raw}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>
      <div className="sidebar-footer">
        <button className="footer-item" onClick={p.onAiPreferences} aria-label="Preferências de IA">
          <IconGear /> IA
        </button>
        <button className="footer-item" onClick={p.onShortcuts} aria-label="Atalhos">
          <IconKeyboard /> Atalhos <span className="spacer" />
          <kbd>?</kbd>
        </button>
        <label className="footer-item">
          <span>Tema</span>
          <select aria-label="Tema" value={p.theme} onChange={(e) => p.onTheme(e.target.value as ThemeId)}>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </aside>
  )
}
