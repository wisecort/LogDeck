import { useState } from 'react'
import type { BuildInfo } from '../../shared/ipc'
import { formatDateTime } from '../format'
import { useI18n } from '../i18n'
import { IconBuild, IconCopy } from './icons'

interface Props {
  namespace: string
  build: BuildInfo
}

const phaseTone = (phase: string) => (phase === 'Complete' ? 'ok' : phase === 'Failed' || phase === 'Error' || phase === 'Cancelled' ? 'bad' : 'warn')

function duration(ms: number): string {
  const s = Math.round(ms / 1000)
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`
}

/** An OKD build whose pod was pruned: what is still known about it, and why there is no log. */
export function BuildDetails({ namespace, build: b }: Props) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  // read-only, for the user's own terminal
  const describe = `oc describe build/${b.name} -n ${namespace}`
  const finished = b.startedAt !== undefined && b.durationMs !== undefined ? b.startedAt + b.durationMs : undefined
  const rows: Array<[string, string | undefined]> = [
    [t('bd.status'), b.phase + (b.reason ? ` — ${b.reason}` : '')],
    [t('bd.strategy'), b.strategy],
    [t('bd.commit'), b.commit],
    [t('bd.started'), b.startedAt !== undefined ? formatDateTime(b.startedAt) : undefined],
    [t('bd.finished'), finished !== undefined ? formatDateTime(finished) : undefined],
    [t('bd.duration'), b.durationMs !== undefined ? duration(b.durationMs) : undefined],
    [t('bd.pod'), b.podName],
  ]
  return (
    <div className="build-details" data-testid="build-details">
      <div className="build-card">
        <header className="build-head">
          <span className={`welcome-icon tone-${phaseTone(b.phase)}`}>
            <IconBuild />
          </span>
          <div>
            <h2 className="mono">{b.name}</h2>
            <span className="muted">{t('bd.subtitle', { ns: namespace })}</span>
          </div>
          <span className="spacer" />
          <span className={`pill ${phaseTone(b.phase)}`}>{b.phase}</span>
        </header>
        <dl className="build-grid">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} style={{ display: 'contents' }}>
                <dt>{k}</dt>
                <dd className={k === t('bd.commit') || k === t('bd.pod') ? 'mono' : undefined}>{v}</dd>
              </div>
            ))}
        </dl>
        <div className="build-nolog">
          <strong>{t('bd.noLogTitle')}</strong>
          <span>{t('bd.noLog')}</span>
        </div>
        <div className="build-cmd">
          <code className="mono">{describe}</code>
          <button
            className="icon-btn labeled"
            onClick={() => {
              void window.logdeck.copyText(describe)
              setCopied(true)
            }}
          >
            <IconCopy /> {copied ? t('common.copied') : t('common.copy')}
          </button>
        </div>
      </div>
    </div>
  )
}
