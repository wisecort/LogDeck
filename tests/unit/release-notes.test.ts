import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs script without types
import { releaseNotes } from '../../scripts/release-notes.mjs'

const changelog = [
  '# Changelog',
  '',
  '## [Unreleased]',
  '',
  '## [1.5.0] — 2026-10-12',
  '',
  '- **English README**.',
  '- winget.',
  '',
  '## [1.4.0] — 2026-10-12',
  '',
  '### Visual',
  '',
  '- Cockpit.',
  '',
].join('\n')
const repo = 'wisecort/LogDeck'

describe('releaseNotes', () => {
  it('takes only the section of the version, without its heading', () => {
    const notes = releaseNotes(changelog, '1.5.0', repo)
    expect(notes.startsWith('- **English README**.\n- winget.')).toBe(true)
    expect(notes).not.toContain('1.4.0')
    expect(notes).not.toContain('## [1.5.0]')
  })

  it('keeps sub-headings and stops at the next version', () => {
    expect(releaseNotes(changelog, '1.4.0', repo)).toMatch(/^### Visual\n\n- Cockpit\.\n/)
  })

  it('ends with the code signing policy and full changelog links', () => {
    const notes = releaseNotes(changelog, '1.5.0', repo)
    expect(notes).toContain('[Code signing policy](https://github.com/wisecort/LogDeck#code-signing-policy)')
    expect(notes).toContain('[Full changelog](https://github.com/wisecort/LogDeck/blob/main/CHANGELOG.md)')
  })

  it('accepts a v-prefixed tag', () => {
    expect(releaseNotes(changelog, 'v1.5.0', repo)).toContain('winget')
  })

  it('fails when the version has no section or the section is empty', () => {
    expect(() => releaseNotes(changelog, '9.9.9', repo)).toThrow(/9\.9\.9/)
    expect(() => releaseNotes('## [1.0.0] — 2026-10-12\n\n## [0.9.0]\n- x\n', '1.0.0', repo)).toThrow(/vazia|empty/)
  })

  it('rejects an invalid version', () => {
    expect(() => releaseNotes(changelog, '1.5', repo)).toThrow()
  })
})
