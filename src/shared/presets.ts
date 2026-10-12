// Exclusion presets saved per context + namespace (P3). Pure data helpers shared by main and UI.

export interface ExclusionPreset {
  id: string
  name: string
  terms: string[]
  builtin?: boolean
}

export interface NamespacePresets {
  /** User presets (the built-in one is not stored). */
  presets: ExclusionPreset[]
  /** Ids of active presets, built-in included. */
  active: string[]
}

export const HEALTH_CHECK_PRESET: ExclusionPreset = {
  id: 'health-checks',
  name: 'Ocultar health checks',
  terms: ['checagem de disponibilidade', 'kube-probe/', 'GET /healthz', 'GET /readyz', 'GET /livez', 'GET /ping'],
  builtin: true,
}

export const BUILTIN_PRESETS: readonly ExclusionPreset[] = [HEALTH_CHECK_PRESET]

const MAX_PRESETS = 50
const MAX_TERMS = 50
const MAX_NAME = 60
const MAX_TERM = 200

export function presetKey(context: string, namespace: string): string {
  return `${context}::${namespace}`
}

function strings(value: unknown, max: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.slice(0, maxLength))
    .slice(0, max)
}

/** Validates presets coming from disk or IPC. */
export function sanitizePresets(raw: unknown): NamespacePresets {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as { presets?: unknown; active?: unknown }
  const builtinIds = new Set(BUILTIN_PRESETS.map((p) => p.id))
  const presets: ExclusionPreset[] = []
  for (const p of Array.isArray(obj.presets) ? obj.presets : []) {
    if (presets.length >= MAX_PRESETS) break
    const { id, name, terms } = (p ?? {}) as Record<string, unknown>
    if (typeof id !== 'string' || !id || builtinIds.has(id) || typeof name !== 'string') continue
    presets.push({ id: id.slice(0, MAX_NAME), name: name.slice(0, MAX_NAME), terms: strings(terms, MAX_TERMS, MAX_TERM) })
  }
  const known = new Set([...builtinIds, ...presets.map((p) => p.id)])
  const active = strings(obj.active, MAX_PRESETS + BUILTIN_PRESETS.length, MAX_NAME).filter((id) => known.has(id))
  return { presets, active }
}

/** Union of the terms of every active preset. */
export function activeTerms(p: NamespacePresets): string[] {
  const all = [...BUILTIN_PRESETS, ...p.presets]
  return [...new Set(all.filter((x) => p.active.includes(x.id)).flatMap((x) => x.terms))]
}
