import { describe, expect, it } from 'vitest'
import { isStoreBuild } from '../../src/platform/distribution'

describe('isStoreBuild', () => {
  it('is true only when Electron says the app runs from a Microsoft Store (MSIX) package', () => {
    expect(isStoreBuild({ windowsStore: true })).toBe(true)
    expect(isStoreBuild({ windowsStore: false })).toBe(false)
    expect(isStoreBuild({})).toBe(false)
  })
})
