import { formatAge } from '../../k8s/pods'
import type { LogEntry } from '../../logs/types'
import type { PodInfo } from '../../shared/ipc'
import { formatTime } from '../format'
import { THEMES, type ThemeId } from '../theme'
import { nsKey, type Navigation } from '../useNavigation'
import { IconBookmark, IconChevron, IconGear, IconKeyboard, IconStar, IconTerminal, IconX } from './icons'

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
}

function podDot(status: string): string {
  if (status === 'Running' || status === 'Completed') return 'ok'
  if (/BackOff|Error|Failed|OOM|Init:|Terminating/.test(status)) return 'bad'
  return 'warn'
}

export function Sidebar(p: Props) {
  const { nav, selection } = p
  const isFav = (c: string, n: string) => nav.favorites.some((f) => f.context === c && f.namespace === n)

  const renderPods = (context: string, namespace: string) => {
    const list = nav.pods[nsKey(context, namespace)]
    if (!list) return nav.loading.has(`ns:${nsKey(context, namespace)}`) ? <li className="muted node">carregando…</li> : null
    if (list.length === 0) return <li className="muted node">nenhum pod</li>
    return list.map((pod) => {
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

  const renderNamespace = (context: string, namespace: string) => {
    const key = nsKey(context, namespace)
    const open = nav.expanded.has(`ns:${key}`)
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

        <div className="section-label">Contextos</div>
        <ul className="tree" aria-label="Contextos">
          {nav.contexts.map((c) => {
            const open = nav.expanded.has(`ctx:${c.name}`)
            const ns = nav.namespaces[c.name]
            return (
              <li key={c.name}>
                <button className="node" aria-expanded={open} onClick={() => void nav.toggleContext(c.name)} title={c.name}>
                  <IconChevron open={open} />
                  <span className={`dot ${c.production ? 'bad' : c.current ? 'ok' : ''}`} />
                  <span className="node-label">{c.name}</span>
                  {c.production && <span className="node-meta error-text">PROD</span>}
                  {c.current && <span className="node-meta">atual</span>}
                </button>
                {open && (
                  <ul>
                    {!ns && <li className="muted node">carregando…</li>}
                    {ns?.namespaces.map((n) => renderNamespace(c.name, n))}
                    {ns && !ns.canList && (
                      <li>
                        <input
                          className="ns-input"
                          aria-label={`Outro namespace em ${c.name}`}
                          placeholder="sem permissão para listar; digite e Enter"
                          onKeyDown={(e) => {
                            const v = (e.target as HTMLInputElement).value.trim()
                            if (e.key === 'Enter' && v) {
                              nav.addNamespace(c.name, v)
                              void nav.openNamespace(c.name, v, true)
                            }
                          }}
                        />
                      </li>
                    )}
                  </ul>
                )}
              </li>
            )
          })}
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
