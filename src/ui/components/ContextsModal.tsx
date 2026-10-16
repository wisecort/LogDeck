import { useEffect, useState } from 'react'
import type { KubeconfigView } from '../../shared/ipc'
import { createPortal } from 'react-dom'
import { contextLabel, deleteContextCommand } from '../context-view'
import { useI18n } from '../i18n'
import type { Navigation } from '../useNavigation'
import { IconCopy, IconFile, IconFolder, IconX } from './icons'

/**
 * Kubeconfig files and folders beyond the default one (F1.6). Paths come from a system dialog in main and
 * reach kubectl as the KUBECONFIG list; LogDeck never reads the files. Contexts reload after each change.
 */
function KubeconfigFiles({ nav }: { nav: Navigation }) {
  const { t } = useI18n()
  const [view, setView] = useState<KubeconfigView>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    void window.logdeck.getKubeconfigs().then(setView)
  }, [])
  const change = async (next: Promise<KubeconfigView>) => {
    const before = view
    const v = await next
    setView(v)
    if (JSON.stringify(before) === JSON.stringify(v)) return
    try {
      nav.showContexts(await window.logdeck.listContexts())
      setError(undefined)
    } catch (err) {
      setError(t('ctx.reloadError', { msg: (err as Error).message }))
    }
  }
  if (!view) return null
  return (
    <section className="kubeconfig-files" aria-label={t('ctx.files')}>
      <h3>{t('ctx.files')}</h3>
      <p className="muted">{t('ctx.filesHelp')}</p>
      <ul className="kubeconfig-list">
        <li>
          <label className="kubeconfig-default" title={view.sources.length === 0 ? t('ctx.useDefaultHint') : undefined}>
            <input type="checkbox" checked={view.useDefault} disabled={view.sources.length === 0} onChange={(e) => void change(window.logdeck.useDefaultKubeconfig(e.target.checked))} />
            {t('ctx.useDefault')}
          </label>
          <span className="mono muted kubeconfig-path" title={view.defaults.join('\n')}>
            <bdi>{view.defaults.join(', ')}</bdi>
          </span>
        </li>
        {view.sources.map((s, i) => (
          <li key={`${s.kind}:${s.path}`} data-testid="kubeconfig-source">
            {s.kind === 'folder' ? <IconFolder /> : <IconFile />}
            <span className="mono kubeconfig-path" title={s.path}>
              <bdi>{s.path}</bdi>
            </span>
            <span className={s.missing ? 'error-text' : 'muted'}>
              {s.missing ? t('ctx.missing') : s.kind === 'folder' ? (s.files === 1 ? t('ctx.folderFilesOne') : t('ctx.folderFiles', { n: s.files })) : ''}
            </span>
            <button className="icon-btn" aria-label={t('ctx.removeLabel', { path: s.path })} title={t('ctx.removeLabel', { path: s.path })} onClick={() => void change(window.logdeck.removeKubeconfig(i))}>
              <IconX />
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="error-text">{error}</p>}
      <div className="kubeconfig-actions">
        <button onClick={() => void change(window.logdeck.addKubeconfig('file'))}>
          <IconFile /> {t('ctx.addFile')}
        </button>
        <button onClick={() => void change(window.logdeck.addKubeconfig('folder'))}>
          <IconFolder /> {t('ctx.addFolder')}
        </button>
      </div>
    </section>
  )
}

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
        <KubeconfigFiles nav={nav} />
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
