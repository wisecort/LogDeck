import { useState } from 'react'
import { createPortal } from 'react-dom'
import { contextLabel, deleteContextCommand } from '../context-view'
import { useI18n } from '../i18n'
import type { Navigation } from '../useNavigation'
import { IconCopy } from './icons'

/** Show/hide contexts in LogDeck. Removing from the kubeconfig is left to the user's terminal (G1/G4). */
export function ContextsModal({ nav, onClose }: { nav: Navigation; onClose(): void }) {
  const { t } = useI18n()
  const [filter, setFilter] = useState('')
  const [copied, setCopied] = useState<string>()
  const list = nav.contexts.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()))
  // Portal: the picker lives inside the sidebar; the dialog must cover the whole window.
  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('ctx.title')} onClick={onClose}>
      <div className="modal ctx-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('ctx.title')}</h2>
        <p className="muted">{t('ctx.help')}</p>
        {nav.contexts.length > 6 && (
          <input className="ns-input" aria-label={t('ctx.filter')} placeholder={t('ctx.filter')} value={filter} onChange={(e) => setFilter(e.target.value)} />
        )}
        <ul className="ctx-list">
          {list.map((c) => {
            const hidden = nav.hiddenContexts.includes(c.name)
            const l = contextLabel(c.name)
            const alias = nav.aliases[c.name] ?? ''
            return (
              <li key={c.name} className={`ctx-row ${hidden ? 'is-hidden' : ''}`} data-testid="ctx-row">
                <div className="ctx-name" title={c.name}>
                  <strong>{l.title}</strong>
                  {c.production && <span className="pill bad">PROD</span>}
                  {c.current && <span className="pill">{t('sidebar.current')}</span>}
                  {l.subtitle && <div className="muted mono">{l.subtitle}</div>}
                </div>
                <input
                  className="ns-input alias-input"
                  aria-label={t('ctx.aliasLabel', { name: c.name })}
                  placeholder={t('ctx.aliasPh')}
                  defaultValue={alias}
                  maxLength={60}
                  onBlur={(e) => nav.setAlias(c.name, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  }}
                />
                <button aria-label={hidden ? t('ctx.showLabel', { name: c.name }) : t('ctx.hideLabel', { name: c.name })} onClick={() => nav.toggleHidden(c.name)}>
                  {hidden ? t('ctx.show') : t('ctx.hide')}
                </button>
                <button
                  className="icon-btn"
                  aria-label={t('ctx.removeCmdLabel', { name: c.name })}
                  title={deleteContextCommand(c.name)}
                  onClick={() => {
                    void window.logdeck.copyText(deleteContextCommand(c.name))
                    setCopied(c.name)
                  }}
                >
                  <IconCopy /> {copied === c.name ? t('common.copied') : t('ctx.removeCmd')}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="modal-actions">
          <span className="muted">{nav.hiddenContexts.length === 1 ? t('ctx.hiddenOne') : t('ctx.hiddenMany', { n: nav.hiddenContexts.length })}</span>
          <span className="spacer" />
          <button onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
