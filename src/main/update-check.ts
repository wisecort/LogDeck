// The only network call outside src/ai/providers/ (G6): one anonymous GET to a fixed GitHub URL,
// made only after the user opted in. Nothing about the user, the cluster or the logs is sent.
import { readFile } from 'node:fs/promises'
import { isNewerVersion, parseLatestRelease, type UpdateInfo } from '../shared/update'

export const LATEST_RELEASE_URL = 'https://api.github.com/repos/wisecort/LogDeck/releases/latest'

const MAX_BYTES = 1_000_000
const TIMEOUT_MS = 10_000

interface CheckOptions {
  current: string
  /** Local JSON used instead of the network (E2E tests, via LOGDECK_UPDATE_FEED). */
  feedFile?: string
  fetchImpl?: typeof fetch
}

/** Returns null on any failure: the check is a convenience and never shows an error. */
export async function checkLatestRelease({ current, feedFile, fetchImpl = fetch }: CheckOptions): Promise<UpdateInfo | null> {
  try {
    const text = feedFile ? await readFile(feedFile, 'utf8') : await download(fetchImpl)
    if (text === null || text.length > MAX_BYTES) return null
    const release = parseLatestRelease(JSON.parse(text))
    if (!release) return null
    return { current, latest: release.version, url: release.url, newer: isNewerVersion(release.version, current) }
  } catch {
    return null
  }
}

async function download(fetchImpl: typeof fetch): Promise<string | null> {
  const res = await fetchImpl(LATEST_RELEASE_URL, {
    method: 'GET',
    redirect: 'error',
    credentials: 'omit',
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'LogDeck' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) return null
  const declared = Number(res.headers.get('content-length') ?? 0)
  if (declared > MAX_BYTES) return null
  return res.text()
}
