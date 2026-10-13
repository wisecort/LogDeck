import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs script without types
import { bumpManifests, latestTemplateVersion } from '../../scripts/winget-manifests.mjs'

const SHA = 'A'.repeat(64)
const installer = [
  'PackageIdentifier: wisecort.LogDeck',
  'PackageVersion: 1.4.0',
  'ReleaseDate: 2026-10-12',
  'Installers:',
  '- Architecture: x64',
  '  InstallerUrl: https://github.com/wisecort/LogDeck/releases/download/v1.4.0/LogDeck-1.4.0-x64.exe',
  '  InstallerSha256: 83FFE5A2392C0CAB89B53B11BC832F50FF395183238E668B05FCD95F616F2140',
  '  ProductCode: e55cfad5-591f-5b25-a318-724c1d407391',
  '  AppsAndFeaturesEntries:',
  '  - DisplayName: LogDeck 1.4.0',
  '    DisplayVersion: 1.4.0',
  '',
].join('\n')
const locale = 'PackageVersion: 1.4.0\nCopyright: Copyright (c) 2026 Matheus Corteletti\nReleaseNotesUrl: https://github.com/wisecort/LogDeck/releases/tag/v1.4.0\n'

describe('bumpManifests', () => {
  const out = bumpManifests(
    { 'wisecort.LogDeck.installer.yaml': installer, 'wisecort.LogDeck.locale.en-US.yaml': locale },
    { from: '1.4.0', to: '1.5.0', sha256: SHA.toLowerCase(), date: '2026-11-02' },
  )
  const inst = out['wisecort.LogDeck.installer.yaml']

  it('moves every version reference to the new version', () => {
    expect(inst).toContain('PackageVersion: 1.5.0')
    expect(inst).toContain('download/v1.5.0/LogDeck-1.5.0-x64.exe')
    expect(inst).toContain('DisplayName: LogDeck 1.5.0')
    expect(inst).toContain('DisplayVersion: 1.5.0')
    expect(out['wisecort.LogDeck.locale.en-US.yaml']).toContain('releases/tag/v1.5.0')
    expect(Object.values(out).join('\n')).not.toContain('1.4.0')
  })
  it('sets the new installer hash (upper case) and release date', () => {
    expect(inst).toContain(`InstallerSha256: ${SHA}`)
    expect(inst).toContain('ReleaseDate: 2026-11-02')
  })
  it('keeps what does not depend on the version', () => {
    expect(inst).toContain('ProductCode: e55cfad5-591f-5b25-a318-724c1d407391')
    expect(out['wisecort.LogDeck.locale.en-US.yaml']).toContain('Copyright (c) 2026 Matheus Corteletti')
  })
  it('rejects bad input instead of writing a broken manifest', () => {
    expect(() => bumpManifests({}, { from: '1.4.0', to: '1.5', sha256: SHA, date: '2026-11-02' })).toThrow()
    expect(() => bumpManifests({}, { from: '1.4.0', to: '1.5.0', sha256: 'abc', date: '2026-11-02' })).toThrow()
    expect(() => bumpManifests({}, { from: '1.4.0', to: '1.5.0', sha256: SHA, date: '02/11/2026' })).toThrow()
  })
})

describe('latestTemplateVersion', () => {
  it('picks the highest x.y.z folder, numerically', () => {
    expect(latestTemplateVersion(['1.4.0', '1.10.0', '1.9.2', 'notes'])).toBe('1.10.0')
  })
})
