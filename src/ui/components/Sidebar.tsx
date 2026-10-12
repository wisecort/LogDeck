import { useState } from 'react'
import { formatAge } from '../../k8s/pods'
import type { LogEntry } from '../../logs/types'
import type { BuildInfo, PodInfo } from '../../shared/ipc'
import { displayLabel } from '../context-view'
import type { RecentPod } from '../recents'
import { ContextsModal } from './ContextsModal'
import { formatTime } from '../format'
import { useI18n } from '../i18n'
import { nsKey, type Navigation } from '../useNavigation'
import { IconBookmark, IconBuild, IconChevron, IconClock, IconCube, IconFile, IconGear, IconKeyboard, IconSliders, IconStar, IconTerminal, IconX } from './icons'

export type { Selection } from '../view-types'
import type { Selection } from '../view-types'

interface Props {
  nav: Navigation
  selection: Selection
  onPod(context: string, namespace: string, pod: PodInfo, inNewTab: boolean): void
  /** A build whose pod the cluster already removed: show its details. */
  onBuild(context: string, namespace: string, build: BuildInfo): void
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
const SHOW_PODS_KEY = 'logdeck.showPodsFolder'

function loadFlag(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}

function saveFlag(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? '1' : '0')
  } catch {
    // ignore
  }
}

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

function buildDot(phase: string): string {
  if (phase === 'Complete') return 'ok'
  if (phase === 'Failed' || phase === 'Error' || phase === 'Cancelled') return 'bad'
  return 'warn'
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  return s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s` : `${s}s`
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
  const [showPods, setShowPods] = useState(() => loadFlag(SHOW_PODS_KEY, true))
  const togglePods = () => {
    setShowPods((on) => {
      saveFlag(SHOW_PODS_KEY, !on)
      return !on
    })
  }
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
    const matches = (name: string) => !q || namespace.toLowerCase().includes(q) || name.toLowerCase().includes(q)
    const shown = list.filter((pod) => matches(pod.name))
    const builds = (nav.builds[nsKey(context, namespace)] ?? []).filter((b) => matches(b.name))
    if (list.length === 0 && builds.length === 0) return <li className="muted node">{t('sidebar.noPods')}</li>
    if (shown.length === 0 && builds.length === 0) return <li className="muted node">{t('sidebar.noPodsMatch', { q: podFilter.trim() })}</li>
    // OKD build and deployer pods go to a "Builds" folder after the app pods (collapsed by default, remembered).
    const extra = shown.filter((pod) => pod.kind !== 'app')
    const containerList = (pod: PodInfo) => {
      const containers = [...pod.containers, ...pod.initContainers]
      if (containers.length < 2) return null
      return (
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
      )
    }
    const row = (pod: PodInfo) => {
      const selected = selection.context === context && selection.namespace === namespace && selection.pod?.name === pod.name
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
          {selected && containerList(pod)}
        </li>
      )
    }
    const rows = shown.filter((pod) => pod.kind === 'app').map(row)
    // OKD Build objects first (their pod, when still there, opens the log); then deployer pods and build pods
    // without a Build object.
    const byName = new Map(list.map((pod) => [pod.name, pod]))
    const buildPods = new Set(builds.map((b) => b.podName))
    const others = extra.filter((pod) => !buildPods.has(pod.name))
    const buildRow = (b: BuildInfo) => {
      const pod = byName.get(b.podName)
      const selected = selection.namespace === namespace && (pod ? selection.pod?.name === pod.name : selection.build?.name === b.name)
      const details = [b.phase + (b.reason ? ` (${b.reason})` : ''), b.strategy, b.commit && `commit ${b.commit}`, b.durationMs !== undefined && formatDuration(b.durationMs)]
        .filter(Boolean)
        .join(' · ')
      return (
        <li key={`build:${b.name}`}>
          <button
            className={`node build-row ${selected ? 'selected' : ''}`}
            data-nolog={!pod || undefined}
            onClick={(e) => (pod ? p.onPod(context, namespace, pod, e.metaKey || e.ctrlKey) : p.onBuild(context, namespace, b))}
            title={`${b.name}\n${details}\n${pod ? t('sidebar.buildOpenLog') : t('sidebar.buildNoLog')}`}
          >
            <span className={`dot ${buildDot(b.phase)}`} />
            <span className="node-label mono">{b.name}</span>
            <span className={`node-meta ${buildDot(b.phase) === 'bad' ? 'error-text' : ''}`}>{b.phase}</span>
            {b.startedAt !== undefined && <span className="node-meta">{formatAge(p.now - b.startedAt)}</span>}
          </button>
        </li>
      )
    }
    const count = builds.length + others.length
    if (count === 0) return rows.length > 0 ? rows : <li className="muted node">{t('sidebar.noPods')}</li>
    // With builds, the namespace shows two folders side by side: Pods (open by default) and Builds (closed).
    const appCount = shown.filter((pod) => pod.kind === 'app').length
    return [
      <li key="__pods">
        <button className="node builds-folder" aria-expanded={showPods} onClick={togglePods}>
          <IconChevron open={showPods} />
          <IconCube />
          <span className="node-label">{t('sidebar.podsFolder')}</span>
          <span className="node-meta">{appCount}</span>
        </button>
        {showPods && <ul aria-label={t('sidebar.podsFolder')}>{rows.length > 0 ? rows : <li className="muted node">{t('sidebar.noPods')}</li>}</ul>}
      </li>,
      <li key="__builds">
        <button className="node builds-folder" aria-expanded={showBuilds} onClick={toggleBuilds} title={t('sidebar.buildsHint')}>
          <IconChevron open={showBuilds} />
          <IconBuild />
          <span className="node-label">{t('sidebar.buildsFolder')}</span>
          <span className="node-meta">{count}</span>
        </button>
        {showBuilds && (
          <ul aria-label={t('sidebar.buildsFolder')}>
            {builds.map(buildRow)}
            {others.map(row)}
          </ul>
        )}
      </li>,
    ]
  }

  /** A namespace stays visible when its name or one of its loaded pods matches the search. */
  const nsMatches = (context: string, namespace: string) =>
    !q ||
    namespace.toLowerCase().includes(q) ||
    (nav.pods[nsKey(context, namespace)] ?? []).some((pod) => pod.name.toLowerCase().includes(q)) ||
    (nav.builds[nsKey(context, namespace)] ?? []).some((b) => b.name.toLowerCase().includes(q))

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
