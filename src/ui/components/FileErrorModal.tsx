import type { LogFileProblem } from '../../logs/file'
import { useI18n } from '../i18n'
import { IconFile } from './icons'

interface Props {
  problem: LogFileProblem
  fileName: string
  /** Limit for `tooBig`, in MB. */
  mb: number
  onOpenOther(): void
  onClose(): void
}

/** A log file that could not be opened (issue #24): centered, and it stays until the user answers it (OK or Esc). */
export function FileErrorModal(p: Props) {
  const { t } = useI18n()
  return (
    <div className="modal-backdrop">
      <div className="modal file-error-modal" role="alertdialog" aria-modal="true" aria-labelledby="file-error-title" aria-describedby="file-error-text">
        <header className="modal-head">
          <span className="modal-head-icon tone-warn">
            <IconFile />
          </span>
          <h2 id="file-error-title">{t(`file.${p.problem}`)}</h2>
        </header>
        <code className="mono file-error-name">{p.fileName}</code>
        <p id="file-error-text" className="muted">
          {t(`file.${p.problem}Hint`, { mb: p.mb })}
        </p>
        <div className="modal-actions file-error-actions">
          <button onClick={p.onClose}>OK</button>
          <button className="primary" autoFocus onClick={p.onOpenOther}>
            {t('file.openOther')}
          </button>
        </div>
      </div>
    </div>
  )
}
