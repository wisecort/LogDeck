import { useState } from 'react'
import { formatAge } from '../../k8s/pods'
import type { LogEntry } from '../../logs/types'
import type { PodInfo } from '../../shared/ipc'
import { displayLabel } from '../context-view'
import type { RecentPod } from '../recents'
import { ContextsModal } from './ContextsModal'
import { formatTime } from '../format'
import { useI18n } from '../i18n'
import { nsKey, type Navigation } from '../useNavigation'
import { IconBookmark, IconChevron, IconClock, IconFile, IconGear, IconKeyboard, IconSliders, IconStar, IconTerminal, IconX } from './icons'

export type { Selection } from '../view-types'
import type { Selection } from '../view-types'

interface Props {
  nav: Navigation
  selection: Selection
  onPod(context: string, namespace: string, pod: PodInfo, inNewTab: boolean): void
  onContainer(name: string): void
  bookmarks: LogEntry[]
  onBookmark(seq: number): void
  shellOpen: boolean
  onCloseShell(): void
  now: number
  onPreferences(): void
  recents: RecentPod[]
  onRecent(r: RecentPod): void
  onAiPreferences(): void
  onShortcuts(): void
  onOpenFile(): void
  fileName?: string
}

const MANAGE = '__manage__'
const SHOW_BUILDS_KEY = 'logdeck.showBuildPods'

function loadShowBuilds(): boolean {
  try {
    return localStorage.getItem(SHOW_BUILDS_KEY) === '1'
  } catch {
    return false
  }
}

function saveShowBuilds(on: boolean): void {
  try {
    localStorage.setItem(SHOW_BUILDS_KEY, on ? '1' : '0')
  } catch {
    // ignore
  }
}

function podDot(status: string): string {
  if (status === 'Running' || status === 'Completed') return 'ok'
  if (/BackOff|Error|Failed|OOM|Init:|Terminating/.test(status)) return 'bad'
  return 'warn'
}

export function Sidebar(p: Props) {
  const { nav, selection } = p
  const { t, k } = useI18n()
  const [managing, setManaging] = useState(false)
  const [podFilter, setPodFilter] = useState('')
  const [showBuilds, setShowBuilds] = useState(loadShowBuilds)
  const toggleBuilds = () => {
    setShowBuilds((on) => {
      saveShowBuilds(!on)
      return !on
    })
  }
  const q = podFilter.trim().toLowerCase()
  const active = nav.contexts.find((c) => c.name === nav.activeContext)
  const activeNs = active ? nav.namespaces[active.name] : undefined
  const isFav = (c: string, n: string) => nav.favorites.some((f) => f.context === c && f.namespace === n)

  const renderPods = (context: string, namespace: string) => {
    const list = nav.pods[nsKey(context, namespace)]
    if (!list) return nav.loading.has(`ns:${nsKey(context, namespace)}`) ? <li className="muted node">{t('common.loading')}</li> : null
    if (list.length === 0) return <li className="muted node">{t('sidebar.noPods')}</li>
    const shown = q && !namespace.toLowerCase().includes(q) ? list.filter((pod) => pod.name.toLowerCase().includes(q)) : list
    if (shown.length === 0) return <li className="muted node">{t('sidebar.noPodsMatch', { q: podFilter.trim() })}</li>
    // OKD build and deployer pods: hidden by default, one toggle for all namespaces.
    const extra = shown.filter((pod) => pod.kind !== 'app')
    const visible = showBuilds ? shown : shown.filter((pod) => pod.kind === 'app')
    const rows = visible.map((pod) => {
      const selected = selection.context === context && selection.namespace === namespace && selection.pod?.name === pod.name
      const containers = [...pod.containers, ...pod.initContainers]
      return (
        <li key={pod.name}>
          <button
            className={`node ${selected ? 'selected' : ''}`}
            onClick={(e) => p.onPod(context, namespace, pod, e.metaKey || e.ctrlKey)}
            onAuxClick={(e) => {
              if (e.button === 1) p.onPod(context, namespace, pod, true)
            }}
            title={`${t('sidebar.podTitle', { name: pod.name, status: pod.status, ready: pod.ready, restarts: pod.restarts })}\n${t('sidebar.newTabHint')}`}
          >
            <span className={`dot ${podDot(pod.status)}`} />
            <span className="node-label mono">{pod.name}</span>
            {pod.kind !== 'app' && <span className="pill pod-kind">{pod.kind}</span>}
            {pod.restarts > 0 && <span className="node-meta">↻{pod.restarts}</span>}
            {pod.createdAt !== undefined && <span className="node-meta">{formatAge(p.now - pod.createdAt)}</span>}
          </button>
          {selected && containers.length > 1 && (
            <ul role="group" aria-label={t('sidebar.containers')}>
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
    if (extra.length === 0) return rows
    return [
      ...rows,
      <li key="__builds">
        <button className="node build-toggle" aria-pressed={showBuilds} onClick={toggleBuilds} title={t('sidebar.buildsHint')}>
          <span className="node-label muted">{showBuilds ? t('sidebar.hideBuilds') : t('sidebar.showBuilds', { n: extra.length })}</span>
        </button>
      </li>,
    ]
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
            aria-label={t('sidebar.favorite', { ns: namespace })}
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
          {t('sidebar.context')}
          {active?.production && <span className="pill bad">PROD</span>}
        </label>
        <select
          id="ctx-select"
          aria-label={t('sidebar.context')}
          value={active?.name ?? ''}
          disabled={nav.contexts.length === 0}
          title={active ? displayLabel(active.name, nav.aliases).title : undefined}
          onChange={(e) => (e.target.value === MANAGE ? setManaging(true) : nav.selectContext(e.target.value))}
        >
          {nav.visible.map((c) => {
            const l = displayLabel(c.name, nav.aliases)
            return (
              <option key={c.name} value={c.name} title={c.name}>
                {l.title}
                {l.subtitle && ` (${l.subtitle})`}
                {c.production ? ' — PROD' : ''}
                {c.current ? ` • ${t('sidebar.current')}` : ''}
              </option>
            )
          })}
          <option disabled>──────────</option>
          <option value={MANAGE}>{t('sidebar.manageContexts')}</option>
        </select>
        {managing && <ContextsModal nav={nav} onClose={() => setManaging(false)} />}
      </div>
      <nav className="sidebar-scroll" aria-label={t('sidebar.navigation')}>
        {p.recents.length > 0 && (
          <>
            <div className="section-label">
              <IconClock /> {t('sidebar.recents')}
            </div>
            <ul className="tree" aria-label={t('sidebar.recents')}>
              {p.recents.map((r) => (
                <li key={`${r.context}::${r.namespace}::${r.pod}`}>
                  <button className="node" onClick={() => p.onRecent(r)} title={`${r.namespace} / ${r.pod} / ${r.container}\n${r.context}`}>
                    <span className="node-label mono">{r.pod}</span>
                    <span className="node-meta">{r.namespace}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {nav.favorites.length > 0 && (
          <>
            <div className="section-label">
              <IconStar /> {t('sidebar.favorites')}
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

        <div className="section-label">{t('sidebar.namespaces')}</div>
        {active && (
          <input
            id="pod-search"
            className="ns-input pod-filter"
            type="search"
            aria-label={t('sidebar.searchPods')}
            placeholder={`${t('sidebar.searchPods')}…`}
            title={t('sidebar.searchPodsHint')}
            value={podFilter}
            onChange={(e) => setPodFilter(e.target.value)}
          />
        )}
        {!active && <p className="muted node">{t('sidebar.noContexts')}</p>}
        {active && (
          <ul className="tree" aria-label="Namespaces">
            {!activeNs && <li className="muted node">carregando…</li>}
            {activeNs?.namespaces.filter((n) => nsMatches(active.name, n)).map((n) => renderNamespace(active.name, n))}
            {activeNs && !activeNs.canList && (
              <li>
                <input
                  className="ns-input"
                  aria-label={t('sidebar.otherNamespace', { context: active.name })}
                  placeholder={t('sidebar.cannotList')}
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

        <div className="section-label">{t('sidebar.file')}</div>
        <ul className="tree">
          <li>
            <button className="node" onClick={p.onOpenFile} title={t('sidebar.openFileHint')}>
              <IconFile />
              <span className="node-label">{t('sidebar.openFile')}</span>
              <kbd>{k('⌘O')}</kbd>
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
            <div className="section-label">{t('sidebar.terminals')}</div>
            <ul className="tree">
              <li>
                <div className="node">
                  <IconTerminal />
                  <span className="node-label mono">
                    {selection.pod.name}/{selection.container}
                  </span>
                  <button className="icon-btn" aria-label={t('sidebar.closeTerminal')} onClick={p.onCloseShell}>
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
              <IconBookmark /> {t('sidebar.bookmarks', { n: p.bookmarks.length })}
            </div>
            <ul className="tree" aria-label={t('sidebar.bookmarksLabel')}>
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
        <button className="footer-item" onClick={p.onPreferences} aria-label={t('sidebar.preferences')}>
          <IconSliders /> {t('sidebar.preferences')}
        </button>
        <button className="footer-item" onClick={p.onAiPreferences} aria-label={t('sidebar.aiPreferences')}>
          <IconGear /> {t('sidebar.ai')}
        </button>
        <button className="footer-item" onClick={p.onShortcuts} aria-label={t('sidebar.shortcuts')}>
          <IconKeyboard /> {t('sidebar.shortcuts')} <span className="spacer" />
          <kbd>?</kbd>
        </button>
      </div>
    </aside>
  )
}
