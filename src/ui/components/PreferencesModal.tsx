import { APP_AUTHOR, APP_REPOSITORY } from '../../shared/app-info'
import logo from '../assets/logo.png'
import { LANGUAGES, useI18n, type Lang, type MessageKey } from '../i18n'
import { BUFFER_CHOICES } from '../buffer-pref'
import { THEME_PREVIEW, THEMES, type ThemeId } from '../theme'
import { IconGithub, IconLinkedin, IconSliders, IconX } from './icons'

interface Props {
  theme: ThemeId
  onTheme(t: ThemeId): void
  lang: Lang
  onLang(l: Lang): void
  updates: boolean
  onUpdates(on: boolean): void
  /** Lines each live log keeps (RNF2). */
  bufferLines: number
  onBufferLines(n: number): void
  onClose(): void
}

/** Appearance (theme thumbnails, language) and About (Cockpit look). */
export function PreferencesModal(p: Props) {
  const { t } = useI18n()
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('pref.title')} onClick={p.onClose}>
      <div className="modal prefs-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <span className="modal-head-icon">
            <IconSliders />
          </span>
          <h2>{t('pref.title')}</h2>
          <span className="spacer" />
          <button className="icon-btn" aria-label={t('common.close')} onClick={p.onClose}>
            <IconX />
          </button>
        </header>

        {/* Wide windows: themes and updates on the left; language, lines per live log and About on the right (all visible at once). */}
        <div className="prefs-cols">
          <div className="prefs-side">
            <section className="pref-section">
              <div className="panel-section-title">{t('pref.theme')}</div>
              <div className="theme-grid" role="radiogroup" aria-label={t('pref.theme')}>
                {THEMES.map((th) => {
                  const c = THEME_PREVIEW[th.id]
                  const on = p.theme === th.id
                  return (
                    <button key={th.id} role="radio" aria-checked={on} className={`theme-card ${on ? 'on' : ''}`} onClick={() => p.onTheme(th.id)}>
                      <span className="theme-thumb" style={{ background: c.bg }} aria-hidden="true">
                        <span className="theme-thumb-side" style={{ background: c.panel }} />
                        <span className="theme-thumb-lines">
                          {c.levels.map((color, i) => (
                            <span key={i} className="theme-thumb-line">
                              <i style={{ background: color }} />
                              <b style={{ background: c.fg, opacity: 0.35, width: `${70 - i * 15}%` }} />
                            </span>
                          ))}
                        </span>
                        <span className="theme-thumb-accent" style={{ background: c.accent }} />
                      </span>
                      <span className="theme-name">{t(`theme.${th.id}` as MessageKey)}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="pref-section">
              <div className="panel-section-title">{t('pref.updates')}</div>
              <label className="pref-check">
                <input type="checkbox" checked={p.updates} onChange={(e) => p.onUpdates(e.target.checked)} />
                {t('pref.updatesToggle')}
              </label>
              <p className="muted pref-note">{t('pref.updatesNote')}</p>
            </section>
          </div>

          <div className="prefs-side">
            <section className="pref-section">
              <div className="panel-section-title">{t('pref.language')}</div>
              <div className="segmented" role="radiogroup" aria-label={t('pref.language')}>
                {LANGUAGES.map((l) => (
                  <button key={l.id} role="radio" aria-checked={p.lang === l.id} className={p.lang === l.id ? 'on' : ''} onClick={() => p.onLang(l.id)}>
                    {l.name}
                  </button>
                ))}
              </div>
              <p className="muted pref-note">{t('pref.languageNote')}</p>
            </section>


            <section className="pref-section">
              <div className="panel-section-title">{t('pref.bufferLines')}</div>
              <div className="segmented buffer-choices" role="radiogroup" aria-label={t('pref.bufferLines')}>
                {BUFFER_CHOICES.map((n) => (
                  <button key={n} role="radio" aria-checked={p.bufferLines === n} className={p.bufferLines === n ? 'on' : ''} onClick={() => p.onBufferLines(n)}>
                    {t('pref.bufferChoice', { n: n / 1000 })}
                  </button>
                ))}
              </div>
              <p className="muted pref-note">{t('pref.bufferNote')}</p>
            </section>

            <section className="pref-section">
              <div className="panel-section-title">{t('pref.about')}</div>
              <div className="about-card" data-testid="about">
                <img src={logo} alt="" width={56} height={56} />
                <div className="about">
                  <strong>LogDeck {__APP_VERSION__}</strong>
                  <span className="muted">{t('pref.tagline')}</span>
                  <span className="muted">
                    {t('pref.license')} ·{' '}
                    <button className="link mono" onClick={() => void window.logdeck.openLink('github')}>
                      {APP_REPOSITORY.replace('https://', '')}
                    </button>
                  </span>
                  <span>{t('pref.madeBy', { author: APP_AUTHOR })}</span>
                </div>
                <div className="about-links">
                  <button className="icon-btn labeled" aria-label={t('pref.openGithub')} onClick={() => void window.logdeck.openLink('github')}>
                    <IconGithub /> GitHub
                  </button>
                  <button className="icon-btn labeled" aria-label={t('pref.openLinkedin')} onClick={() => void window.logdeck.openLink('linkedin')}>
                    <IconLinkedin /> LinkedIn
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
