import logo from '../assets/logo.png'
import { useI18n } from '../i18n'
import type { RecentPod } from '../recents'
import { useState } from 'react'
import { IconCopy, IconCube, IconFile, IconHistory } from './icons'

interface Props {
  contexts: number
  currentContext?: string
  kubectl?: string
  /** kubectl is not installed: the install command for this OS (winget, brew, snap). */
  kubectlMissing?: string
  onCopyHint?(hint: string): void
  onRecheckKubectl?(): void
  lastRecent?: RecentPod
  onPods(): void
  onFile(): void
  onRecent(r: RecentPod): void
  /** Shown once, until the user answers whether LogDeck may check for new versions. */
  askUpdates?: boolean
  onUpdates?(on: boolean): void
}

/** Empty tab: what you can do, with shortcuts (Cockpit look). */
export function Welcome(p: Props) {
  const { t, k } = useI18n()
  const [copied, setCopied] = useState(false)
  return (
    <div className="welcome" data-testid="welcome">
      <div className="welcome-hero">
        <img className="welcome-logo" src={logo} alt="" width={88} height={88} />
        <h1>LogDeck</h1>
        <p className="welcome-tagline">{t('welcome.tagline')}</p>
      </div>
      {p.kubectlMissing && (
        <div className="welcome-missing" data-testid="kubectl-missing" role="alert">
          <strong>{t('welcome.kubectlTitle')}</strong>
          <span className="muted">{t('welcome.kubectlText')}</span>
          <div className="welcome-missing-cmd">
            <code className="mono" data-testid="kubectl-install-hint">{p.kubectlMissing}</code>
            <button
              className="welcome-missing-copy"
              onClick={() => {
                p.onCopyHint?.(p.kubectlMissing!)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
            >
              <IconCopy /> {copied ? t('common.copied') : t('welcome.kubectlCopy')}
            </button>
            <button className="primary" onClick={() => p.onRecheckKubectl?.()}>
              {t('welcome.kubectlRecheck')}
            </button>
          </div>
          <span className="muted">{t('welcome.kubectlFile', { key: k('⌘O') })}</span>
        </div>
      )}
      <div className="welcome-cards">
        <button className="welcome-card tone-green" onClick={p.onPods}>
          <span className="welcome-icon">
            <IconCube />
          </span>
          <strong>{t('welcome.pods')}</strong>
          <span className="muted">{t('welcome.podsHint')}</span>
        </button>
        <button className="welcome-card tone-blue" onClick={p.onFile}>
          <kbd className="welcome-kbd">{k('⌘O')}</kbd>
          <span className="welcome-icon">
            <IconFile />
          </span>
          <strong>{t('welcome.file')}</strong>
          <span className="muted">{t('welcome.fileHint')}</span>
        </button>
        <button className="welcome-card tone-purple" disabled={!p.lastRecent} onClick={() => p.lastRecent && p.onRecent(p.lastRecent)}>
          <span className="welcome-icon">
            <IconHistory />
          </span>
          <strong>{t('welcome.recent')}</strong>
          <span className="muted mono">{p.lastRecent ? `${p.lastRecent.pod} / ${p.lastRecent.container}` : t('welcome.noRecent')}</span>
        </button>
      </div>
      <div className="welcome-status" data-testid="welcome-status">
        <span className="live-dot" />
        {p.currentContext ? t('welcome.context', { name: p.currentContext }) : t('sidebar.noContexts')}
        <span className="sep">·</span>
        {t('welcome.contexts', { n: p.contexts })}
        {p.kubectl && (
          <>
            <span className="sep">·</span>
            <span className="mono">kubectl {p.kubectl}</span>
          </>
        )}
      </div>
      {p.askUpdates && (
        <div className="welcome-ask" data-testid="update-ask">
          <div>
            <strong>{t('upd.askTitle')}</strong>
            <span className="muted">{t('upd.askText')}</span>
          </div>
          <button className="icon-btn labeled" onClick={() => p.onUpdates?.(false)}>
            {t('upd.askNo')}
          </button>
          <button className="primary" onClick={() => p.onUpdates?.(true)}>
            {t('upd.askYes')}
          </button>
        </div>
      )}
      <p className="welcome-tip">{t('welcome.tip')}</p>
    </div>
  )
}
