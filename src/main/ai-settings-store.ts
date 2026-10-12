import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { DEFAULT_AI_SETTINGS, sanitizeAiSettings, type AiSettings } from '../shared/ai-settings'

/** AI settings in userData (no secrets: keys live in the Keychain). */
export class AiSettingsStore {
  private settings: AiSettings = DEFAULT_AI_SETTINGS

  constructor(private readonly file: string) {
    if (!existsSync(file)) return
    try {
      this.settings = sanitizeAiSettings(JSON.parse(readFileSync(file, 'utf8')))
    } catch {
      this.settings = DEFAULT_AI_SETTINGS
    }
  }

  get(): AiSettings {
    return this.settings
  }

  set(partial: unknown): AiSettings {
    this.settings = sanitizeAiSettings(partial, this.settings)
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.settings, null, 2))
    renameSync(tmp, this.file)
    return this.settings
  }
}
