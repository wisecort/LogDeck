import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { HEALTH_CHECK_PRESET, sanitizePresets, type NamespacePresets } from '../shared/presets'

/** JSON file in userData with exclusion presets per `context::namespace` (P3). */
export class PresetStore {
  private data: Record<string, NamespacePresets> = {}

  constructor(private readonly file: string) {
    if (!existsSync(file)) return
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
      for (const [key, value] of Object.entries(raw)) this.data[key] = sanitizePresets(value)
    } catch {
      this.data = {}
    }
  }

  /** New namespaces start with health checks hidden. */
  get(key: string): NamespacePresets {
    return this.data[key] ?? { presets: [], active: [HEALTH_CHECK_PRESET.id] }
  }

  set(key: string, value: NamespacePresets): NamespacePresets {
    const clean = sanitizePresets(value)
    this.data[key] = clean
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.data, null, 2))
    renameSync(tmp, this.file)
    return clean
  }
}
