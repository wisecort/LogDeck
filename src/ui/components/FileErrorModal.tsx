import type { LogFileProblem } from '../../logs/file'
import { useI18n } from '../i18n'
import { IconFile } from './icons'

interface Props {
  /** Why the file did not open, or `large`: it opens, but the user confirms first. */
  problem: LogFileProblem | 'large'
  fileName: string
  /** File size in bytes. */
  size: number
  /** Limit for `tooBig`, in bytes. */
  max: number
  onOpenOther(): void
  /** `large` only: open it anyway. */
  onConfirm?(): void
  onClose(): void
}

const gb = (bytes: number) => Math.round((bytes / 1024 ** 3) * 10) / 10

/** A log file that could not be opened (issue #24), or a very large one: centered, it stays until answered (or Esc). */
export function FileErrorModal(p: Props) {
  const { t, n } = useI18n()
  const large = p.problem === 'large'
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
          {t(`file.${p.problem}Hint`, { size: n(gb(p.size)), gb: n(gb(p.max)) })}
        </p>
        <div className="modal-actions file-error-actions">
          {large ? (
            <>
              <button onClick={p.onClose}>{t('common.cancel')}</button>
              <button className="primary" autoFocus onClick={p.onConfirm}>
                {t('file.openAnyway')}
              </button>
            </>
          ) : (
            <>
              <button onClick={p.onClose}>OK</button>
              <button className="primary" autoFocus onClick={p.onOpenOther}>
                {t('file.openOther')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
