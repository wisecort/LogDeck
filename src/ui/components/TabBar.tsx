import { useI18n } from '../i18n'
import { tabLabel, type Tab } from '../tabs'
import { IconHome, IconPlus, IconX } from './icons'

interface Props {
  tabs: Tab[]
  active: string
  onActivate(id: string): void
  onClose(id: string): void
  onNew(): void
  onHome(): void
  /** The active tab shows the home screen: the Home button is lit. */
  homeActive?: boolean
}

/** Open pods/files; each tab keeps its own stream running in the background. */
export function TabBar(p: Props) {
  const { t } = useI18n()
  return (
    <div className="tabbar" role="tablist" aria-label={t('tabs.label')}>
      <button className="icon-btn log-tab-home" aria-label={t('tabs.home')} aria-pressed={!!p.homeActive} title={t('tabs.homeHint')} onClick={p.onHome}>
        <IconHome />
      </button>
      {p.tabs.map((tab) => {
        // Pod and file names are monospace; an empty tab shows the home screen and is called "Início".
        const named = tabLabel(tab)
        const label = named ?? t('tabs.home')
        const on = tab.id === p.active
        return (
          <div key={tab.id} className={`log-tab ${on ? 'on' : ''}`} data-testid="log-tab">
            <button role="tab" aria-selected={on} className={`log-tab-label${named ? ' mono' : ''}`} title={label} onClick={() => p.onActivate(tab.id)}>
              {label}
            </button>
            <button className="icon-btn log-tab-close" aria-label={t('tabs.close', { name: label })} onClick={() => p.onClose(tab.id)}>
              <IconX />
            </button>
          </div>
        )
      })}
      <button className="icon-btn log-tab-add" aria-label={t('tabs.add')} title={t('tabs.addHint')} onClick={p.onNew}>
        <IconPlus />
      </button>
    </div>
  )
}
