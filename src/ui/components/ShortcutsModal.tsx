import { useI18n, type MessageKey } from '../i18n'
import { IconKeyboard, IconX } from './icons'

/** A key combo: plain keys, or `#key` for a translated word ("clique no nível"). */
type Combo = string[]

interface Shortcut {
  combos: Combo[]
  label: MessageKey
}

const GROUPS: Array<{ title: MessageKey; items: Shortcut[] }> = [
  {
    title: 'keys.groupGeneral',
    items: [
      { combos: [['⌘', 'O']], label: 'keys.open' },
      { combos: [['?']], label: 'keys.help' },
      { combos: [['Esc']], label: 'keys.esc' },
    ],
  },
  {
    title: 'keys.groupSearch',
    items: [
      { combos: [['⌘', 'F']], label: 'keys.search' },
      { combos: [['⌘', 'G'], ['⇧', '⌘', 'G']], label: 'keys.next' },
    ],
  },
  {
    title: 'keys.groupMouse',
    items: [
      { combos: [['⌥', '#keys.clickLevel']], label: 'keys.solo' },
      { combos: [['⌘', '#keys.clickPod']], label: 'keys.newTab' },
      { combos: [['#keys.middleClickPod']], label: 'keys.newTab' },
    ],
  },
]

const PC: Record<string, string> = { '⌘': 'Ctrl', '⇧': 'Shift', '⌥': 'Alt' }
const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent)

export function ShortcutsModal({ onClose }: { onClose(): void }) {
  const { t } = useI18n()
  const key = (k: string) => (k.startsWith('#') ? t(k.slice(1) as MessageKey) : isMac ? k : (PC[k] ?? k))
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('keys.title')} onClick={onClose}>
      <div className="modal keys-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <span className="modal-head-icon">
            <IconKeyboard />
          </span>
          <h2>{t('keys.title')}</h2>
          <span className="spacer" />
          <button className="icon-btn" aria-label={t('common.close')} onClick={onClose}>
            <IconX />
          </button>
        </header>
        <div className="keys-groups">
          {GROUPS.map((g) => (
            <section key={g.title} className="keys-group">
              <div className="panel-section-title">{t(g.title)}</div>
              {g.items.map((it, i) => (
                <div key={i} className="keys-row">
                  <span className="keys-label">{t(it.label)}</span>
                  <span className="keys-combos">
                    {it.combos.map((combo, ci) => (
                      <span key={ci} className="keys-combo">
                        {ci > 0 && <span className="keys-or">/</span>}
                        {combo.map((k) => (
                          <kbd key={k} className={k.startsWith('#') ? 'keycap wide' : 'keycap'}>
                            {key(k)}
                          </kbd>
                        ))}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </section>
          ))}
        </div>
        <p className="muted keys-foot">{t('keys.foot')}</p>
      </div>
    </div>
  )
}
