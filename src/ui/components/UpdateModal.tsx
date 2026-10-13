import { useI18n } from '../i18n'
import { IconCopy, IconDownload, IconX } from './icons'

interface Props {
  version: string
  onSkip(): void
  onClose(): void
}

const COMMANDS: Array<{ label: string; cmd: string }> = [
  { label: 'Homebrew', cmd: 'brew update && brew upgrade --cask logdeck' },
  { label: 'winget', cmd: 'winget upgrade wisecort.LogDeck' },
]

/** New version notice: how to update. LogDeck never downloads or installs anything by itself. */
export function UpdateModal(p: Props) {
  const { t } = useI18n()
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('upd.title', { v: p.version })} onClick={p.onClose}>
      <div className="modal update-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <span className="modal-head-icon">
            <IconDownload />
          </span>
          <h2>{t('upd.title', { v: p.version })}</h2>
          <span className="spacer" />
          <button className="icon-btn" aria-label={t('common.close')} onClick={p.onClose}>
            <IconX />
          </button>
        </header>
        <p className="muted">{t('upd.current', { v: __APP_VERSION__ })}</p>
        <div className="panel-section-title">{t('upd.how')}</div>
        <div className="update-cmds">
          {COMMANDS.map((c) => (
            <div key={c.label} className="update-cmd">
              <span className="update-cmd-label">{c.label}</span>
              <code className="mono">{c.cmd}</code>
              <button className="icon-btn" aria-label={`${t('common.copy')} ${c.label}`} title={t('common.copy')} onClick={() => void window.logdeck.copyText(c.cmd)}>
                <IconCopy />
              </button>
            </div>
          ))}
        </div>
        <p className="muted">{t('upd.download')}</p>
        <div className="update-actions">
          <button className="icon-btn labeled" onClick={p.onSkip}>
            {t('upd.skip')}
          </button>
          <span className="spacer" />
          <button className="primary" onClick={() => void window.logdeck.openLink('releases')}>
            {t('upd.open')}
          </button>
        </div>
      </div>
    </div>
  )
}
