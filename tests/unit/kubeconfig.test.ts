import { describe, expect, it } from 'vitest'
import { isKubeconfigName, resolveKubeconfig, sanitizeKubeconfigSettings, withKubeconfig, type KubeconfigFs } from '../../src/k8s/kubeconfig'

/** Fake disk: only names and kinds, the app never reads what is inside (G3). */
function disk(files: string[], dirs: Record<string, string[]> = {}): KubeconfigFs {
  return {
    isFile: (p) => files.includes(p) || Object.entries(dirs).some(([d, names]) => names.some((n) => `${d}/${n}` === p && !n.endsWith('/'))),
    isDir: (p) => p in dirs,
    list: (d) => (dirs[d] ?? []).map((n) => n.replace(/\/$/, '')),
  }
}
const base = { env: {}, platform: 'darwin' as const, home: '/Users/ana' }

describe('isKubeconfigName (files taken from a folder)', () => {
  it.each(['config', 'team-a.yaml', 'b.YML', 'c.conf', 'd.kubeconfig'])('takes %s', (n) => expect(isKubeconfigName(n)).toBe(true))
  it.each(['README.md', 'login.sh', '.hidden.yaml', 'config.bak', 'notes.txt'])('skips %s', (n) => expect(isKubeconfigName(n)).toBe(false))
})

describe('resolveKubeconfig', () => {
  it('nothing added: KUBECONFIG is left as it is', () => {
    expect(resolveKubeconfig({ useDefault: true, sources: [] }, { ...base, fs: disk([]) }).value).toBeUndefined()
  })

  it('a file added joins the default one, in that order', () => {
    const r = resolveKubeconfig({ useDefault: true, sources: [{ kind: 'file', path: '/work/team-b.yaml' }] }, { ...base, fs: disk(['/work/team-b.yaml']) })
    expect(r.value).toBe('/Users/ana/.kube/config:/work/team-b.yaml')
  })

  it('keeps the KUBECONFIG the user already had instead of the default path', () => {
    const r = resolveKubeconfig({ useDefault: true, sources: [{ kind: 'file', path: '/x.yaml' }] }, { ...base, env: { KUBECONFIG: '/a:/b' }, fs: disk(['/x.yaml']) })
    expect(r.value).toBe('/a:/b:/x.yaml')
    expect(r.defaults).toEqual(['/a', '/b'])
  })

  it('a folder adds its kubeconfig files, sorted, and counts them', () => {
    const fs = disk([], { '/k': ['b.yaml', 'a.yml', 'README.md', '.secret.yaml', 'sub/'], '/k/sub': ['x.yaml'] })
    const r = resolveKubeconfig({ useDefault: false, sources: [{ kind: 'folder', path: '/k' }] }, { ...base, fs })
    expect(r.value).toBe('/k/a.yml:/k/b.yaml')
    expect(r.sources[0]).toMatchObject({ files: 2, missing: false })
  })

  it('a file or folder that is gone is skipped and flagged', () => {
    const r = resolveKubeconfig({ useDefault: true, sources: [{ kind: 'file', path: '/gone.yaml' }] }, { ...base, fs: disk([]) })
    expect(r.value).toBe('/Users/ana/.kube/config')
    expect(r.sources[0]).toMatchObject({ missing: true })
  })

  it('Windows uses ; and its own default path', () => {
    const r = resolveKubeconfig({ useDefault: true, sources: [{ kind: 'file', path: 'D:\\k\\a.yaml' }] }, { env: {}, platform: 'win32', home: 'C:\\Users\\ana', fs: disk(['D:\\k\\a.yaml']) })
    expect(r.value).toBe('C:\\Users\\ana\\.kube\\config;D:\\k\\a.yaml')
  })

  it('the same file twice counts once', () => {
    const r = resolveKubeconfig({ useDefault: true, sources: [{ kind: 'file', path: '/Users/ana/.kube/config' }] }, { ...base, fs: disk(['/Users/ana/.kube/config']) })
    expect(r.value).toBe('/Users/ana/.kube/config')
  })
})

describe('withKubeconfig', () => {
  it('sets KUBECONFIG only when there is a value', () => {
    expect(withKubeconfig({ A: '1' }, undefined)).toEqual({ A: '1' })
    expect(withKubeconfig({ KUBECONFIG: '/old' }, '/new')).toEqual({ KUBECONFIG: '/new' })
  })
})

describe('sanitizeKubeconfigSettings', () => {
  it('keeps valid entries and drops the rest', () => {
    const s = sanitizeKubeconfigSettings({ useDefault: false, sources: [{ kind: 'file', path: '/a.yaml' }, { kind: 'url', path: 'x' }, { kind: 'folder', path: 42 }, 'junk'] })
    expect(s).toEqual({ useDefault: false, sources: [{ kind: 'file', path: '/a.yaml' }] })
  })

  it('without sources the default kubeconfig is always used', () => {
    expect(sanitizeKubeconfigSettings({ useDefault: false, sources: [] })).toEqual({ useDefault: true, sources: [] })
    expect(sanitizeKubeconfigSettings(null)).toEqual({ useDefault: true, sources: [] })
  })
})

describe('applyKubeconfig: every kubectl the app starts gets the list', () => {
  it('kubectlEnv carries KUBECONFIG while files are added, and stops after they are removed', async () => {
    const { mkdtempSync, writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { applyKubeconfig } = await import('../../src/k8s/kubeconfig')
    const { kubectlEnv } = await import('../../src/k8s/kubectl')
    const file = join(mkdtempSync(join(tmpdir(), 'logdeck-kc-')), 'extra.yaml')
    writeFileSync(file, '')
    try {
      applyKubeconfig({ useDefault: false, sources: [{ kind: 'file', path: file }] }, { KUBECONFIG: '/base' })
      expect(kubectlEnv({ PATH: '' })['KUBECONFIG']).toBe(file)
    } finally {
      applyKubeconfig({ useDefault: true, sources: [] })
    }
    expect(kubectlEnv({ PATH: '' })['KUBECONFIG']).toBeUndefined()
  })
})
