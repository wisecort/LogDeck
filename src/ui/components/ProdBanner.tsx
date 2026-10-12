import { useI18n } from '../i18n'

export function ProdBanner({ context }: { context: string }) {
  const { t } = useI18n()
  return (
    <div className="prod-banner" role="alert" data-testid="prod-banner" title={context}>
      {t('prod.banner')}
    </div>
  )
}
