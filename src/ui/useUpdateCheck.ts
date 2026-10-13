import { useCallback, useEffect, useState } from 'react'
import { isNewerVersion, shouldCheckForUpdate, type UpdateConsent } from '../shared/update'

const CONSENT = 'logdeck.updateCheck'
const LAST = 'logdeck.updateLastCheck'
const LATEST = 'logdeck.updateLatest'
const SKIP = 'logdeck.updateSkip'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // storage unavailable: the check just runs again next launch
  }
}

function loadConsent(): UpdateConsent {
  const v = read(CONSENT)
  return v === 'on' || v === 'off' ? v : null
}

/**
 * New-version notice. Nothing is fetched until the user says yes (consent stays null until asked);
 * then at most one anonymous GET a day, done by main. Returns the newer version to announce, if any.
 */
export function useUpdateCheck() {
  const [consent, setConsentState] = useState<UpdateConsent>(loadConsent)
  const [latest, setLatest] = useState<string | null>(() => read(LATEST))
  const [skipped, setSkipped] = useState<string | null>(() => read(SKIP))

  useEffect(() => {
    const now = Date.now()
    if (!shouldCheckForUpdate({ consent, lastCheck: Number(read(LAST) ?? 0), now })) return
    let alive = true
    void window.logdeck
      .checkUpdate()
      .then((info) => {
        write(LAST, String(now))
        if (!alive || !info) return
        write(LATEST, info.latest)
        setLatest(info.latest)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [consent])

  const setConsent = useCallback((value: 'on' | 'off') => {
    write(CONSENT, value)
    if (value === 'off') {
      write(LATEST, null)
      setLatest(null)
    }
    setConsentState(value)
  }, [])

  const skip = useCallback((version: string) => {
    write(SKIP, version)
    setSkipped(version)
  }, [])

  const available = consent === 'on' && latest && latest !== skipped && isNewerVersion(latest, __APP_VERSION__) ? latest : undefined
  return { consent, setConsent, available, skip }
}
