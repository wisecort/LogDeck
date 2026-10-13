import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { checkLatestRelease, LATEST_RELEASE_URL } from '../../src/main/update-check'
import { isNewerVersion, parseLatestRelease, shouldCheckForUpdate, UPDATE_INTERVAL_MS } from '../../src/shared/update'

const release = (over: Record<string, unknown> = {}) => ({
  tag_name: 'v1.5.0',
  html_url: 'https://github.com/wisecort/LogDeck/releases/tag/v1.5.0',
  draft: false,
  prerelease: false,
  ...over,
})

describe('isNewerVersion', () => {
  it('compares major, minor and patch numerically', () => {
    expect(isNewerVersion('1.5.0', '1.4.0')).toBe(true)
    expect(isNewerVersion('1.10.0', '1.9.3')).toBe(true)
    expect(isNewerVersion('2.0.0', '1.99.99')).toBe(true)
    expect(isNewerVersion('1.4.1', '1.4.0')).toBe(true)
  })
  it('is false for the same or an older version', () => {
    expect(isNewerVersion('1.4.0', '1.4.0')).toBe(false)
    expect(isNewerVersion('1.3.9', '1.4.0')).toBe(false)
  })
  it('is false when either side is not a plain x.y.z version', () => {
    expect(isNewerVersion('1.5.0-beta', '1.4.0')).toBe(false)
    expect(isNewerVersion('banana', '1.4.0')).toBe(false)
    expect(isNewerVersion('1.5.0', 'dev')).toBe(false)
  })
})

describe('parseLatestRelease', () => {
  it('reads the version and the release page', () => {
    expect(parseLatestRelease(release())).toEqual({ version: '1.5.0', url: 'https://github.com/wisecort/LogDeck/releases/tag/v1.5.0' })
  })
  it('ignores drafts and pre-releases', () => {
    expect(parseLatestRelease(release({ draft: true }))).toBeNull()
    expect(parseLatestRelease(release({ prerelease: true }))).toBeNull()
  })
  it('rejects tags that are not vX.Y.Z', () => {
    expect(parseLatestRelease(release({ tag_name: 'v1.5' }))).toBeNull()
    expect(parseLatestRelease(release({ tag_name: 'v1.5.0<script>' }))).toBeNull()
    expect(parseLatestRelease(release({ tag_name: 42 }))).toBeNull()
  })
  it('never trusts a link outside the LogDeck releases page', () => {
    expect(parseLatestRelease(release({ html_url: 'https://evil.example.com/LogDeck/releases/tag/v1.5.0' }))).toEqual({
      version: '1.5.0',
      url: 'https://github.com/wisecort/LogDeck/releases/tag/v1.5.0',
    })
  })
  it('returns null for anything that is not an object', () => {
    expect(parseLatestRelease(null)).toBeNull()
    expect(parseLatestRelease('v1.5.0')).toBeNull()
    expect(parseLatestRelease([release()])).toBeNull()
  })
})

describe('shouldCheckForUpdate', () => {
  const now = 1_800_000_000_000
  it('checks only when the user opted in', () => {
    expect(shouldCheckForUpdate({ consent: 'on', lastCheck: 0, now })).toBe(true)
    expect(shouldCheckForUpdate({ consent: 'off', lastCheck: 0, now })).toBe(false)
    expect(shouldCheckForUpdate({ consent: null, lastCheck: 0, now })).toBe(false)
  })
  it('checks at most once a day', () => {
    expect(shouldCheckForUpdate({ consent: 'on', lastCheck: now - UPDATE_INTERVAL_MS + 1000, now })).toBe(false)
    expect(shouldCheckForUpdate({ consent: 'on', lastCheck: now - UPDATE_INTERVAL_MS, now })).toBe(true)
  })
  it('checks again when the clock went backwards', () => {
    expect(shouldCheckForUpdate({ consent: 'on', lastCheck: now + 60_000, now })).toBe(true)
  })
})

describe('checkLatestRelease', () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

  it('makes one anonymous GET to the fixed GitHub URL', async () => {
    const fetchImpl = vi.fn(async () => ok(release()))
    const result = await checkLatestRelease({ current: '1.4.0', fetchImpl })
    expect(result).toEqual({ current: '1.4.0', latest: '1.5.0', url: 'https://github.com/wisecort/LogDeck/releases/tag/v1.5.0', newer: true })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(LATEST_RELEASE_URL)
    expect(LATEST_RELEASE_URL).toBe('https://api.github.com/repos/wisecort/LogDeck/releases/latest')
    expect(init.method).toBe('GET')
    expect(init.redirect).toBe('error')
    expect(init.credentials).toBe('omit')
    expect(init.body).toBeUndefined()
    const headers = new Headers(init.headers)
    expect(headers.get('user-agent')).toBe('LogDeck')
    expect(headers.get('authorization')).toBeNull()
    expect(headers.get('cookie')).toBeNull()
  })

  it('never touches the network in a Microsoft Store build (the Store updates the app)', async () => {
    const fetchImpl = vi.fn(async () => ok(release()))
    expect(await checkLatestRelease({ current: '1.4.0', fetchImpl, storeBuild: true })).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports when the installed version is already the latest', async () => {
    const result = await checkLatestRelease({ current: '1.5.0', fetchImpl: async () => ok(release()) })
    expect(result?.newer).toBe(false)
  })

  it('returns null on network errors, HTTP errors, bad JSON or oversized answers', async () => {
    expect(await checkLatestRelease({ current: '1.4.0', fetchImpl: async () => Promise.reject(new Error('offline')) })).toBeNull()
    expect(await checkLatestRelease({ current: '1.4.0', fetchImpl: async () => new Response('{}', { status: 403 }) })).toBeNull()
    expect(await checkLatestRelease({ current: '1.4.0', fetchImpl: async () => new Response('not json', { status: 200 }) })).toBeNull()
    const huge = JSON.stringify({ ...release(), body: 'x'.repeat(2_000_000) })
    expect(await checkLatestRelease({ current: '1.4.0', fetchImpl: async () => new Response(huge, { status: 200 }) })).toBeNull()
  })

  it('reads a local feed file instead of the network when one is given (tests)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'logdeck-update-'))
    const feed = join(dir, 'latest.json')
    writeFileSync(feed, JSON.stringify(release({ tag_name: 'v9.9.0', html_url: 'x' })))
    const fetchImpl = vi.fn()
    const result = await checkLatestRelease({ current: '1.4.0', feedFile: feed, fetchImpl })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result).toEqual({ current: '1.4.0', latest: '9.9.0', url: 'https://github.com/wisecort/LogDeck/releases/tag/v9.9.0', newer: true })
  })
})
