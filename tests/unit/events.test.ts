import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseEvents } from '../../src/k8s/events'
import { FIXTURES } from '../helpers/fake-kubectl'

const EVENTS = readFileSync(join(FIXTURES, 'kubectl/events.json'), 'utf8')
const WEB = 'portal-web-7d9f8c6b5-x2k4p'

describe('parseEvents (Kubernetes events of one pod)', () => {
  const events = parseEvents(EVENTS, WEB)

  it('keeps only events about that pod, oldest first', () => {
    expect(events.map((e) => e.reason)).toEqual(['Unhealthy', 'Killing', 'Pulled'])
  })

  it('reads type, message, count, first/last time and the container', () => {
    expect(events[0]).toEqual({
      id: 'e1',
      type: 'Warning',
      reason: 'Unhealthy',
      message: 'Readiness probe failed: HTTP probe failed with statuscode: 503',
      count: 3,
      firstTime: Date.parse('2026-10-09T03:26:40Z'),
      lastTime: Date.parse('2026-10-09T03:27:20Z'),
      container: 'php-fpm',
    })
  })

  it('uses eventTime when the old timestamps are missing (events.k8s.io)', () => {
    expect(events[2]).toMatchObject({ count: 1, lastTime: Date.parse('2026-10-09T03:27:34.120Z') })
  })

  it('drops events without any time and caps long messages', () => {
    const json = JSON.stringify({
      items: [
        { involvedObject: { kind: 'Pod', name: WEB }, reason: 'NoTime', message: 'x' },
        { involvedObject: { kind: 'Pod', name: WEB }, reason: 'Long', message: 'y'.repeat(5000), lastTimestamp: '2026-10-09T03:27:20Z' },
      ],
    })
    const [only] = parseEvents(json, WEB)
    expect(only!.reason).toBe('Long')
    expect(only!.message.length).toBeLessThanOrEqual(500)
  })

  it('returns [] for empty or malformed lists', () => {
    expect(parseEvents('{}', WEB)).toEqual([])
    expect(() => parseEvents('{oops', WEB)).toThrow()
  })
})
