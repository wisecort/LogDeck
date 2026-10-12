import { mkdtempSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { envPath, extraBinDirs, kubectlInstallHint, resolveExecutable, withExtraPaths } from '../../src/platform/paths'
import { platformKeys } from '../../src/platform/keys'

describe('extra PATH dirs', () => {
  it('macOS adds Homebrew', () => {
    expect(extraBinDirs('darwin', '/Users/x')).toEqual(['/opt/homebrew/bin', '/usr/local/bin', '/Users/x/.local/bin'])
  })

  it('Linux adds snap, Linuxbrew and ~/.local/bin', () => {
    expect(extraBinDirs('linux', '/home/x')).toEqual(['/usr/local/bin', '/snap/bin', '/home/linuxbrew/.linuxbrew/bin', '/home/x/.local/bin'])
  })

  it('Windows adds the user-level bin used by Claude Code and winget links', () => {
    expect(extraBinDirs('win32', 'C:\\Users\\x')).toEqual(['C:\\Users\\x\\.local\\bin', 'C:\\Users\\x\\AppData\\Local\\Microsoft\\WinGet\\Links'])
  })
})

describe('withExtraPaths', () => {
  it('appends with ":" on POSIX without duplicates', () => {
    const env = withExtraPaths({ PATH: '/usr/bin:/opt/homebrew/bin' }, 'darwin', '/Users/x')
    expect(env['PATH']).toBe('/usr/bin:/opt/homebrew/bin:/usr/local/bin:/Users/x/.local/bin')
  })

  it('on Windows keeps the original "Path" key and uses ";"', () => {
    const env = withExtraPaths({ Path: 'C:\\Windows' }, 'win32', 'C:\\Users\\x')
    expect(env['Path']).toBe('C:\\Windows;C:\\Users\\x\\.local\\bin;C:\\Users\\x\\AppData\\Local\\Microsoft\\WinGet\\Links')
    expect(env['PATH']).toBeUndefined()
    expect(envPath(env, 'win32')).toBe(env['Path'])
  })
})

describe('resolveExecutable', () => {
  it('finds an executable in PATH (POSIX)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ld-bin-'))
    writeFileSync(join(dir, 'kubectl'), '#!/bin/sh\n')
    chmodSync(join(dir, 'kubectl'), 0o755)
    expect(resolveExecutable('kubectl', { PATH: `/nope:${dir}` }, 'linux')).toBe(join(dir, 'kubectl'))
    expect(resolveExecutable('missing', { PATH: dir }, 'linux')).toBeUndefined()
  })

  it('on Windows tries .exe and .com, never .cmd/.bat (they need a shell, G2)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ld-win-'))
    writeFileSync(join(dir, 'claude.cmd'), '')
    writeFileSync(join(dir, 'kubectl.exe'), '')
    expect(resolveExecutable('kubectl', { Path: dir }, 'win32')).toBe(join(dir, 'kubectl.exe'))
    expect(resolveExecutable('claude', { Path: dir }, 'win32')).toBeUndefined()
  })

  it('keeps absolute paths', () => {
    expect(resolveExecutable('/usr/bin/security', {}, 'darwin')).toBe('/usr/bin/security')
  })
})

describe('kubectlInstallHint', () => {
  it.each([
    ['darwin', 'brew install kubectl'],
    ['linux', 'snap install kubectl --classic'],
    ['win32', 'winget install -e --id Kubernetes.kubectl'],
  ] as const)('%s', (platform, hint) => {
    expect(kubectlInstallHint(platform)).toContain(hint)
  })
})

describe('platformKeys', () => {
  it('keeps macOS symbols on a Mac', () => {
    expect(platformKeys('Buscar logs… (⌘F) · ⇧ ⌘ G · ⌥ + clique', true)).toBe('Buscar logs… (⌘F) · ⇧ ⌘ G · ⌥ + clique')
  })

  it('uses Ctrl/Shift/Alt elsewhere', () => {
    expect(platformKeys('Buscar logs… (⌘F)', false)).toBe('Buscar logs… (Ctrl+F)')
    expect(platformKeys('⌘ G / ⇧ ⌘ G', false)).toBe('Ctrl+G / Shift+Ctrl+G')
    expect(platformKeys('⌥ + clique no nível', false)).toBe('Alt + clique no nível')
    expect(platformKeys('⌘O', false)).toBe('Ctrl+O')
  })
})
