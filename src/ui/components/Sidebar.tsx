import { formatAge } from '../../k8s/pods'
import type { ContextInfo, NamespaceList, PodInfo } from '../../shared/ipc'

interface Props {
  contexts: ContextInfo[]
  context?: string
  onContext(name: string): void
  namespaces?: NamespaceList
  namespace?: string
  onNamespace(name: string): void
  pods: PodInfo[]
  podsLoading: boolean
  pod?: PodInfo
  onPod(pod: PodInfo): void
  container?: string
  onContainer(name: string): void
  now: number
}

function statusClass(status: string): string {
  if (status === 'Running' || status === 'Completed') return 'ok'
  if (/BackOff|Error|Failed|OOM|Init:/.test(status)) return 'bad'
  return 'warn'
}

export function Sidebar(p: Props) {
  const containers = p.pod ? [...p.pod.containers, ...p.pod.initContainers] : []
  return (
    <aside className="sidebar">
      <label className="field">
        <span>Contexto</span>
        <select aria-label="Contexto" value={p.context ?? ''} onChange={(e) => p.onContext(e.target.value)}>
          <option value="" disabled>
            Escolha um contexto
          </option>
          {p.contexts.map((c) => (
            <option key={c.name} value={c.name}>
              {c.production ? '⚠ ' : ''}
              {c.name}
              {c.current ? ' (atual)' : ''}
            </option>
          ))}
        </select>
      </label>

      {p.context && p.namespaces && (
        <label className="field">
          <span>Namespace</span>
          {p.namespaces.canList ? (
            <select aria-label="Namespace" value={p.namespace ?? ''} onChange={(e) => p.onNamespace(e.target.value)}>
              <option value="" disabled>
                Escolha um namespace
              </option>
              {p.namespaces.namespaces.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          ) : (
            <input
              aria-label="Namespace"
              defaultValue={p.namespace ?? ''}
              placeholder="sem permissão para listar; digite"
              onKeyDown={(e) => {
                if (e.key === 'Enter') p.onNamespace((e.target as HTMLInputElement).value.trim())
              }}
            />
          )}
        </label>
      )}

      {p.namespace && (
        <div className="pods">
          <div className="section-title">Pods {p.podsLoading && <span className="muted">atualizando…</span>}</div>
          <ul aria-label="Pods">
            {p.pods.map((pod) => (
              <li key={pod.name}>
                <button
                  className={`pod ${p.pod?.name === pod.name ? 'selected' : ''}`}
                  onClick={() => p.onPod(pod)}
                  title={`${pod.status} · ${pod.ready} prontos · ${pod.restarts} restarts`}
                >
                  <span className="pod-name">{pod.name}</span>
                  <span className="pod-meta">
                    <span className={`pill ${statusClass(pod.status)}`}>{pod.status}</span>
                    {pod.restarts > 0 && <span className="pill warn">↻ {pod.restarts}</span>}
                    {pod.createdAt !== undefined && <span className="muted">{formatAge(p.now - pod.createdAt)}</span>}
                  </span>
                </button>
              </li>
            ))}
            {!p.podsLoading && p.pods.length === 0 && <li className="muted">Nenhum pod</li>}
          </ul>
        </div>
      )}

      {p.pod && containers.length > 1 && (
        <div className="containers" role="group" aria-label="Containers">
          <div className="section-title">Container</div>
          {containers.map((c) => (
            <button key={c} className={`chip ${p.container === c ? 'on' : ''}`} onClick={() => p.onContainer(c)}>
              {c}
              {p.pod!.initContainers.includes(c) ? ' (init)' : ''}
            </button>
          ))}
        </div>
      )}
    </aside>
  )
}
