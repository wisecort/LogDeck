import { APP_AUTHOR, APP_REPOSITORY } from '../../shared/app-info'
import { LANGUAGES, useI18n, type Lang, type MessageKey } from '../i18n'
import { THEMES, type ThemeId } from '../theme'

interface Props {
  theme: ThemeId
  onTheme(t: ThemeId): void
  lang: Lang
  onLang(l: Lang): void
  onClose(): void
}

/** Appearance (theme, language) and About. */
export function PreferencesModal(p: Props) {
  const { t } = useI18n()
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('pref.title')} onClick={p.onClose}>
      <div className="modal prefs-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('pref.title')}</h2>

        <div className="panel-section-title">{t('pref.appearance')}</div>
        <label className="field">
          <span>{t('pref.theme')}</span>
          <select aria-label={t('pref.theme')} value={p.theme} onChange={(e) => p.onTheme(e.target.value as ThemeId)}>
            {THEMES.map((th) => (
              <option key={th.id} value={th.id}>
                {t(`theme.${th.id}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('pref.language')}</span>
          <select aria-label={t('pref.language')} value={p.lang} onChange={(e) => p.onLang(e.target.value as Lang)}>
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <p className="muted" style={{ fontSize: 12 }}>
          {t('pref.languageNote')}
        </p>

        <div className="panel-section-title">{t('pref.about')}</div>
        <div className="about" data-testid="about">
          <strong>LogDeck {__APP_VERSION__}</strong>
          <span className="muted">{t('pref.tagline')}</span>
          <span>{t('pref.madeBy', { author: APP_AUTHOR })}</span>
          <span className="muted">
            {t('pref.inspired')} · {t('pref.license')} · <span className="mono">{APP_REPOSITORY.replace('https://', '')}</span>
          </span>
        </div>

        <div className="modal-actions">
          <span className="spacer" />
          <button className="primary" onClick={p.onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
