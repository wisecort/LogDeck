import { useI18n, type MessageKey } from '../i18n'

const KEYS: Array<[string | MessageKey, MessageKey]> = [
  ['⌘ O', 'keys.open'],
  ['⌘ F', 'keys.search'],
  ['⌘ G / ⇧ ⌘ G', 'keys.next'],
  ['keys.altClick', 'keys.solo'],
  ['Esc', 'keys.esc'],
  ['?', 'keys.help'],
]

export function ShortcutsModal({ onClose }: { onClose(): void }) {
  const { t, k } = useI18n()
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('keys.title')} onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('keys.title')}</h2>
        <div className="shortcuts">
          {KEYS.map(([key, d]) => (
            <div key={key} style={{ display: 'contents' }}>
              <span>
                <kbd>{key.startsWith('keys.') ? t(key as MessageKey) : k(key)}</kbd>
              </span>
              <span>{t(d)}</span>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <span className="spacer" />
          <button onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  )
}
