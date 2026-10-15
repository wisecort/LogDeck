import { useI18n } from '../i18n'
import { noticeTone, type Notice } from '../notice'
import { IconX } from './icons'

const IconAlert = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5h.01" />
  </svg>
)

const IconWarn = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
)

/** The notice on top of the window: red for cluster errors, amber for warnings, with a short title. */
export function NoticeBar({ notice, onClose }: { notice: Notice; onClose(): void }) {
  const { t } = useI18n()
  const tone = noticeTone(notice.kind)
  return (
    <div className={`notice tone-${tone}`} role={tone === 'error' ? 'alert' : 'status'} data-testid="notice">
      <span className="notice-icon">{tone === 'error' ? <IconAlert /> : <IconWarn />}</span>
      <span className="notice-body">
        <strong>{t(`notice.${notice.kind}`)}</strong>
        <span>{notice.text}</span>
      </span>
      <button className="icon-btn notice-close" aria-label={t('common.close')} title={t('common.close')} onClick={onClose}>
        <IconX />
      </button>
    </div>
  )
}
