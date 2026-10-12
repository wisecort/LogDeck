// F6 group title in the interface language: catalog rules by id, generic groups keep the log message.
import { CATALOG_IDS, type SignatureMatch } from '../logs/signatures'
import type { MessageKey, Translate } from './i18n/core'

export function groupTitle(t: Translate, g: SignatureMatch): string {
  return CATALOG_IDS.includes(g.id) ? t(`sig.${g.id}` as MessageKey) : g.title
}
