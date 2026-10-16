// Extra kubeconfig files and folders chosen by the user (F1.6). They reach kubectl as the KUBECONFIG list,
// with the default one first; the app only checks that the paths exist and lists folder names, it never
// reads what is inside (G3).
import { readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { defaultKubeconfigPath, joinPath, kubeconfigDelimiter } from '../platform/kubeconfig-path'
import { currentPlatform, type Platform } from '../platform/paths'
import type { KubeconfigSettings, KubeconfigSource, KubeconfigView } from '../shared/ipc'

export type { KubeconfigSettings, KubeconfigSource }

export interface KubeconfigFs {
  isFile(path: string): boolean
  isDir(path: string): boolean
  list(dir: string): string[]
}

const MAX_SOURCES = 20
const MAX_PATH = 4096

/** Files taken from a folder: `config`, *.yaml, *.yml, *.conf, *.kubeconfig; hidden files never. */
export const isKubeconfigName = (name: string) => !name.startsWith('.') && (name === 'config' || /\.(ya?ml|conf|kubeconfig)$/i.test(name))

export function sanitizeKubeconfigSettings(v: unknown): KubeconfigSettings {
  const raw = (v && typeof v === 'object' ? v : {}) as { useDefault?: unknown; sources?: unknown }
  const sources: KubeconfigSource[] = []
  for (const s of Array.isArray(raw.sources) ? raw.sources : []) {
    const { kind, path } = (s ?? {}) as { kind?: unknown; path?: unknown }
    if ((kind === 'file' || kind === 'folder') && typeof path === 'string' && path.length > 0 && path.length <= MAX_PATH && !/[\0\r\n]/.test(path)) {
      sources.push({ kind, path })
    }
  }
  const kept = sources.slice(0, MAX_SOURCES)
  // Turning the default off only makes sense with something else in the list.
  return { useDefault: kept.length === 0 || raw.useDefault !== false, sources: kept }
}

export interface ResolveOptions {
  env: NodeJS.ProcessEnv
  platform: Platform
  home: string
  fs: KubeconfigFs
}

export interface Resolved {
  /** KUBECONFIG for kubectl; undefined when nothing was added (the user's setup is left alone). */
  value?: string
  /** The default kubeconfig: the KUBECONFIG the user already had, else kubectl's default path. */
  defaults: string[]
  sources: KubeconfigView['sources']
}

export function resolveKubeconfig(settings: KubeconfigSettings, o: ResolveOptions): Resolved {
  const delimiter = kubeconfigDelimiter(o.platform)
  const fromEnv = (o.env['KUBECONFIG'] ?? '').split(delimiter).filter(Boolean)
  const defaults = fromEnv.length > 0 ? fromEnv : [defaultKubeconfigPath(o.home, o.platform)]
  const sources: KubeconfigView['sources'] = []
  const added: string[] = []
  for (const s of settings.sources) {
    if (s.kind === 'file') {
      const ok = o.fs.isFile(s.path)
      sources.push({ ...s, files: ok ? 1 : 0, missing: !ok })
      if (ok) added.push(s.path)
      continue
    }
    const ok = o.fs.isDir(s.path)
    const files = ok
      ? o.fs
          .list(s.path)
          .filter(isKubeconfigName)
          .sort()
          .map((n) => joinPath(o.platform, s.path, n))
          .filter((p) => o.fs.isFile(p))
      : []
    sources.push({ ...s, files: files.length, missing: !ok })
    added.push(...files)
  }
  if (settings.sources.length === 0) return { defaults, sources }
  const list = [...new Set([...(settings.useDefault ? defaults : []), ...added])]
  return { ...(list.length > 0 && { value: list.join(delimiter) }), defaults, sources }
}

export const nodeFs: KubeconfigFs = {
  isFile: (p) => {
    try {
      return statSync(p).isFile()
    } catch {
      return false
    }
  },
  isDir: (p) => {
    try {
      return statSync(p).isDirectory()
    } catch {
      return false
    }
  },
  list: (d) => {
    try {
      return readdirSync(d)
    } catch {
      return []
    }
  },
}

/** Current KUBECONFIG list for every kubectl the app starts (set by main from the user's choice). */
let current: string | undefined

export function applyKubeconfig(settings: KubeconfigSettings, env: NodeJS.ProcessEnv = process.env, platform: Platform = currentPlatform()): KubeconfigView {
  const r = resolveKubeconfig(settings, { env, platform, home: env['HOME'] ?? env['USERPROFILE'] ?? homedir(), fs: nodeFs })
  current = r.value
  return { useDefault: settings.useDefault, defaults: r.defaults, sources: r.sources }
}

export function withKubeconfig(env: NodeJS.ProcessEnv, value: string | undefined = current): NodeJS.ProcessEnv {
  return value === undefined ? env : { ...env, KUBECONFIG: value }
}
