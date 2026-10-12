import { beforeAll, describe, expect, it } from 'vitest'
import { assemble } from '../../src/logs/classify'
import { matchSignature, normalizeMessage, SignatureIndex, type SignatureGroup } from '../../src/logs/signatures'
import { entry, fixtureLines } from '../helpers/entries'

const AH01075 =
  '[Fri Oct 09 03:26:40.123456 2026] [proxy_fcgi:error] [pid 12:tid 140213] (70007)The timeout specified has expired: [client 10.0.0.2:48660] AH01075: Error dispatching request to : (polling)'
const CHOWN = "chown: changing ownership of '/var/log/php-fpm/error.log': Operation not permitted"

describe('matchSignature (catalog, F6.2)', () => {
  it.each([
    [AH01075, 'ERROR', 'apache-phpfpm-timeout', 'Timeout Apache → PHP-FPM'],
    ['[proxy_fcgi:error] [pid 12] (70007)The timeout specified has expired', 'ERROR', 'apache-phpfpm-timeout', 'Timeout Apache → PHP-FPM'],
    [CHOWN, 'ERROR', 'startup-permission', 'Permissão no startup'],
    ["mkdir: cannot create directory '/run/httpd': Permission denied", 'ERROR', 'startup-permission', 'Permissão no startup'],
    ["chmod: changing permissions of '/var/run/x': Operation not permitted", 'ERROR', 'startup-permission', 'Permissão no startup'],
    ['2026/10/09 03:26:40 [error] 12#12: *1 upstream timed out (110: Connection timed out)', 'ERROR', 'nginx-upstream-timeout', 'Timeout upstream (Nginx)'],
    ['connect ETIMEDOUT 10.0.0.9:5432', 'ERROR', 'node-etimedout', 'Timeout de conexão'],
    ['[pool www] server reached pm.max_children setting (5), consider raising it', 'WARN', 'fpm-max-children', 'PHP-FPM sem workers'],
    ["AH01071: Got error 'PHP message: PHP Fatal error:  Uncaught PDOException'", 'ERROR', 'php-fatal', 'PHP Fatal error'],
  ])('%s → %s', (raw, level, id, title) => {
    expect(matchSignature(entry({ raw, level: level as 'ERROR' }))).toEqual({ id, title })
  })

  it('groups other ERROR/FATAL entries as generic', () => {
    expect(matchSignature(entry({ raw: 'production.ERROR: boom', level: 'ERROR' }))?.id).toBe('generic')
    expect(matchSignature(entry({ raw: 'kernel panic', level: 'FATAL' }))?.id).toBe('generic')
  })

  it('groups timeout lines at any level as generic', () => {
    expect(matchSignature(entry({ raw: "child 25 execution timed out (30 sec), terminating", level: 'WARN' }))?.id).toBe('generic')
  })

  it('ignores ordinary INFO/WARN lines', () => {
    expect(matchSignature(entry({ raw: '"GET / HTTP/1.1" 200', level: 'INFO' }))).toBeNull()
    expect(matchSignature(entry({ raw: 'Cache miss for key x', level: 'WARN' }))).toBeNull()
  })

  it('also looks at continuation lines', () => {
    const e = entry({ raw: 'production.ERROR: x', level: 'ERROR', continuation: ['PHP Fatal error: Allowed memory size exhausted'] })
    expect(matchSignature(e)?.id).toBe('php-fatal')
  })
})

describe('normalizeMessage', () => {
  it('makes AH01075 lines with different pid/port/time equal', () => {
    const other = AH01075.replace('03:26:40.123456', '03:29:00.950926').replace('48660', '51234').replace('140213', '140275')
    expect(normalizeMessage(other)).toBe(normalizeMessage(AH01075))
  })

  it('replaces IPs, numbers, hex and UUIDs', () => {
    const n = normalizeMessage('job 3f2a9c1e-8d4b-4c7e-9a1f-2b3c4d5e6f70 at 0xdeadbeef from 10.0.0.9 took 1234 ms')
    expect(n).not.toMatch(/3f2a9c1e|deadbeef|10\.0\.0\.9|1234/)
    expect(n).toContain('job')
    expect(n).toContain('took')
  })
})

describe('SignatureIndex on the pod log (P4)', () => {
  let groups: SignatureGroup[] = []
  beforeAll(() => {
    const index = new SignatureIndex()
    index.addMany(assemble(fixtureLines('pod-php-apache.log'), { now: () => 0 }))
    groups = index.groups()
  })
  const byKey = (key: string) => groups.find((g) => g.key === key)

  it('groups the six AH01075 timeouts with first and last occurrence', () => {
    expect(byKey('apache-phpfpm-timeout')).toMatchObject({
      id: 'apache-phpfpm-timeout',
      title: 'Timeout Apache → PHP-FPM',
      count: 6,
      firstTime: Date.parse('2026-10-09T03:26:30.950Z'),
      lastTime: Date.parse('2026-10-09T03:29:00.950Z'),
    })
    expect(byKey('apache-phpfpm-timeout')!.sample).toContain('AH01075')
  })

  it('groups the startup permission errors', () => {
    expect(byKey('startup-permission')).toMatchObject({
      title: 'Permissão no startup',
      count: 3,
      firstTime: Date.parse('2026-10-09T03:24:00.000Z'),
      lastTime: Date.parse('2026-10-09T03:24:00.005Z'),
    })
  })

  it('groups pm.max_children warnings', () => {
    expect(byKey('fpm-max-children')?.count).toBe(3)
  })

  it('groups the two Laravel SQL timeouts together as generic', () => {
    const lar = groups.filter((g) => g.id === 'generic' && g.sample.includes('SQLSTATE'))
    expect(lar).toHaveLength(1)
    expect(lar[0]!.count).toBe(2)
  })

  it('uses the kubectl clock for first/last, not a log time without time zone (Laravel UTC-3)', () => {
    const lar = groups.find((g) => g.sample.includes('SQLSTATE'))!
    expect(lar.firstTime).toBe(Date.parse('2026-10-09T03:27:01.700Z'))
    expect(lar.lastTime).toBe(Date.parse('2026-10-09T03:28:01.700Z'))
  })

  it('puts each entry in at most one group and keeps seqs', () => {
    const all = groups.flatMap((g) => g.seqs)
    expect(new Set(all).size).toBe(all.length)
    expect(groups.reduce((n, g) => n + g.count, 0)).toBe(all.length)
  })

  it('sorts groups by count, descending', () => {
    const counts = groups.map((g) => g.count)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
  })

  it('handles entries without time and breaks count ties by the most recent', () => {
    const i = new SignatureIndex()
    i.add(entry({ raw: CHOWN, level: 'ERROR' }))
    i.add(entry({ raw: 'connect ETIMEDOUT 10.0.0.9:5432', level: 'ERROR', k8sTime: 2000 }))
    i.add(entry({ raw: 'connect ETIMEDOUT 10.0.0.9:5432', level: 'ERROR', k8sTime: 1000 }))
    i.add(entry({ raw: AH01075, level: 'ERROR', k8sTime: 5000 }))
    i.add(entry({ raw: 'x', level: 'INFO' }))
    const [first, second, third] = i.groups()
    expect(first).toMatchObject({ id: 'node-etimedout', count: 2, firstTime: 1000, lastTime: 2000 })
    expect(second).toMatchObject({ id: 'apache-phpfpm-timeout', count: 1 })
    expect(third!.id).toBe('startup-permission')
    expect(third!.firstTime).toBeUndefined()
    expect(third!.lastTime).toBeUndefined()
  })

  it('clears', () => {
    const i = new SignatureIndex()
    i.add(entry({ raw: CHOWN, level: 'ERROR' }))
    i.clear()
    expect(i.groups()).toEqual([])
  })
})

describe('OKD build failures (F6)', () => {
  it('groups buildah errors as "Falha no build"', () => {
    const idx = new SignatureIndex()
    idx.add(entry({ raw: 'error: build error: building at STEP "RUN php -m": exit status 1', level: 'ERROR' }))
    idx.add(entry({ raw: 'ERRO: extensao PHP redis ausente na imagem base', level: 'ERROR' }))
    const groups = idx.groups()
    expect(groups.map((g) => [g.title, g.count])).toEqual([['Falha no build', 2]])
  })
})
