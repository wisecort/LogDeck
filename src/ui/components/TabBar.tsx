import { useI18n } from '../i18n'
import { tabLabel, type Tab } from '../tabs'
import { IconHome, IconX } from './icons'

interface Props {
  tabs: Tab[]
  active: string
  onActivate(id: string): void
  onClose(id: string): void
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
        // An empty tab is the home screen: the house button stands for it, it has no tab of its own.
        const label = tabLabel(tab)
        if (label === undefined) return null
        const on = tab.id === p.active
        return (
          <div key={tab.id} className={`log-tab ${on ? 'on' : ''}`} data-testid="log-tab">
            <button role="tab" aria-selected={on} className="log-tab-label mono" title={label} onClick={() => p.onActivate(tab.id)}>
              {label}
            </button>
            <button className="icon-btn log-tab-close" aria-label={t('tabs.close', { name: label })} onClick={() => p.onClose(tab.id)}>
              <IconX />
            </button>
          </div>
        )
      })}
    </div>
  )
}
