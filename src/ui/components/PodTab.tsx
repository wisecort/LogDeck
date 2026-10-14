import type { ContainerDetail, PodInfo, ProbeSummary, Resources, TerminatedRun } from '../../shared/ipc'
import { formatDateTime } from '../format'
import { useI18n, type Translate } from '../i18n'
import { containerDetail, formatDuration, uptime } from '../pod-status'
import type { PodAccess } from '../pod-access'
import { useState } from 'react'
import { IconCheckCircle, IconCopy, IconRows } from './icons'

interface Props {
  pod?: PodInfo
  container?: string
  /** Previous runs seen while the app is open (Kubernetes keeps only the last one). */
  runs: readonly TerminatedRun[]
  now: number
  /** Services selecting the pod and their Routes/Ingresses; undefined while loading. */
  access?: PodAccess
}

function ports(s: PodAccess['services'][number]): string {
  return s.ports.map((p) => `${p.port}${p.targetPort && p.targetPort !== String(p.port) ? `→${p.targetPort}` : ''}${p.name ? ` (${p.name})` : ''}`).join(', ')
}

/** Services and URLs that reach the pod. URLs are copied, never opened by the app (G6). */
function Access({ access }: { access: PodAccess }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState<string>()
  return (
    <>
      <div className="panel-section-title">{t('pod.access')}</div>
      {access.services.length === 0 ? (
        <div className="muted" style={{ fontSize: 12 }}>
          {t('pod.noService')}
        </div>
      ) : (
        <ul className="pod-access" data-testid="pod-access">
          {access.urls.map((u, i) => (
            <li key={`u${i}`} className="url">
              <span className="pill">{u.kind === 'route' ? 'Route' : 'Ingress'}</span>
              <span className="mono url-text" title={`${u.name} → ${u.service}`}>
                {u.url}
              </span>
              <button
                className="icon-btn"
                aria-label={t('pod.copyUrl', { url: u.url })}
                title={copied === u.url ? t('common.copied') : t('common.copy')}
                onClick={() =>
                  void window.logdeck.copyText(u.url).then(() => {
                    setCopied(u.url)
                    setTimeout(() => setCopied(undefined), 2000)
                  })
                }
              >
                {copied === u.url ? <IconCheckCircle /> : <IconCopy />}
              </button>
            </li>
          ))}
          {access.urls.length === 0 && <li className="muted">{t('pod.noUrl')}</li>}
          {access.services.map((s) => (
            <li key={s.name}>
              <span className="pill">Service</span>
              <span className="mono">{s.name}</span>
              <span className="muted mono">
                {s.type} · {ports(s)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function state(t: Translate, c: ContainerDetail, now: number): string {
  const up = uptime(c, now)
  if (up !== undefined) return t('pod.running', { d: formatDuration(up) })
  if (c.state === 'waiting') return t('pod.waiting', { reason: c.reason ?? '—' })
  if (c.state === 'terminated') return t('pod.terminated', { reason: c.reason ?? '—' })
  return c.state === 'running' ? t('pod.runningNoTime') : t('pod.unknown')
}

function resource(t: Translate, key: keyof Resources, c: ContainerDetail): string {
  const req = c.requests?.[key]
  const lim = c.limits?.[key]
  if (!req && !lim) return '—'
  return t('pod.reqLim', { req: req ?? '—', lim: lim ?? '—' })
}

function probe(t: Translate, p: ProbeSummary | undefined): string {
  if (!p) return t('pod.probeNone')
  const target = p.kind === 'command' ? t('pod.probeCommand') : (p.target ?? p.kind)
  return p.periodSeconds !== undefined ? t('pod.probeEvery', { target, s: p.periodSeconds }) : target
}

export function runText(t: Translate, run: TerminatedRun): string {
  const parts = [run.reason ?? '—']
  if (run.exitCode !== undefined) parts.push(`exit ${run.exitCode}`)
  if (run.startedAt !== undefined && run.finishedAt !== undefined) parts.push(t('pod.ran', { d: formatDuration(run.finishedAt - run.startedAt) }))
  return parts.join(' · ')
}

/** Pod tab of the right panel: the container's state, uptime, previous runs, limits and probes. */
export function PodTab({ pod, container, runs, now, access }: Props) {
  const { t } = useI18n()
  const c = containerDetail(pod, container)
  if (!pod || !c)
    return (
      <div className="empty-state">
        <span className="empty-state-icon">
          <IconRows />
        </span>
        {t('pod.empty')}
      </div>
    )
  const failed = (r: TerminatedRun) => r.reason !== 'Completed' && r.exitCode !== 0
  return (
    <div data-testid="pod-tab" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="panel-section-title">{t(c.init ? 'pod.initContainer' : 'pod.container', { name: c.name })}</div>
      <dl className="kv pod-kv">
        <dt>{t('pod.state')}</dt>
        <dd data-testid="pod-state" className={c.state === 'running' ? 'ok-text' : c.state === 'waiting' ? 'error-text' : ''}>
          {state(t, c, now)}
        </dd>
        <dt>{t('pod.restarts')}</dt>
        <dd>{c.restarts}</dd>
        {c.last && (
          <>
            <dt>{t('pod.lastRun')}</dt>
            <dd className={failed(c.last) ? 'error-text' : ''}>{runText(t, c.last)}</dd>
            {c.last.finishedAt !== undefined && (
              <>
                <dt>{t('pod.ended')}</dt>
                <dd>{formatDateTime(c.last.finishedAt)}</dd>
              </>
            )}
          </>
        )}
        <dt>{t('pod.image')}</dt>
        <dd className="mono">{c.image ?? '—'}</dd>
        <dt>{t('pod.memory')}</dt>
        <dd>{resource(t, 'memory', c)}</dd>
        <dt>CPU</dt>
        <dd>{resource(t, 'cpu', c)}</dd>
        <dt>Readiness</dt>
        <dd>{probe(t, c.probes?.readiness)}</dd>
        <dt>Liveness</dt>
        <dd>{probe(t, c.probes?.liveness)}</dd>
        {c.probes?.startup && (
          <>
            <dt>Startup</dt>
            <dd>{probe(t, c.probes.startup)}</dd>
          </>
        )}
      </dl>
      {runs.length > 1 && (
        <>
          <div className="panel-section-title" title={t('pod.runsHint')}>
            {t('pod.runs')}
          </div>
          <ul className="pod-runs">
            {runs.map((r) => (
              <li key={r.finishedAt} className={failed(r) ? 'bad' : ''}>
                <span>{runText(t, r)}</span>
                <span className="muted mono">{formatDateTime(r.finishedAt)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {access && <Access access={access} />}
      <div className="panel-section-title">Pod</div>
      <dl className="kv pod-kv">
        <dt>{t('pod.status')}</dt>
        <dd>{pod.status}</dd>
        <dt>{t('pod.node')}</dt>
        <dd className="mono">{pod.node ?? '—'}</dd>
        <dt>{t('pod.created')}</dt>
        <dd>{pod.createdAt !== undefined ? t('pod.createdValue', { d: formatDuration(now - pod.createdAt), date: formatDateTime(pod.createdAt) }) : '—'}</dd>
        {pod.qosClass && (
          <>
            <dt>QoS</dt>
            <dd>{pod.qosClass}</dd>
          </>
        )}
      </dl>
    </div>
  )
}
