import { describe, expect, it } from 'vitest'
import {
  compileSearch,
  countExcluded,
  entryText,
  filterEntries,
  highlight,
  isUnsafeRegex,
  searchWithTimeout,
  type CompiledSearch,
  type SearchSpec,
} from '../../src/logs/search'
import { entry } from '../helpers/entries'

function compiled(spec: SearchSpec): CompiledSearch {
  const c = compileSearch(spec)
  if (!c.ok) throw new Error(`expected a valid search: ${c.message}`)
  return c
}

const P4 = '[proxy_fcgi:error] (70007)The timeout specified has expired: AH01075: Error dispatching request to : (polling)'

describe('text mode (default)', () => {
  it('is case-insensitive by default', () => {
    const s = compiled({ text: 'fpm' })
    expect(s.matches('[pool www] PHP-FPM child exited')).toBe(true)
    expect(s.matches('apache only')).toBe(false)
  })

  it('treats regex metacharacters literally', () => {
    expect(compiled({ text: 'a.b' }).matches('axb')).toBe(false)
    expect(compiled({ text: '[proxy_fcgi:error]' }).matches(P4)).toBe(true)
    expect(compiled({ text: '(70007)' }).matches(P4)).toBe(true)
  })

  it('can be case-sensitive', () => {
    const s = compiled({ text: 'FPM', caseSensitive: true })
    expect(s.matches('PHP-FPM')).toBe(true)
    expect(s.matches('php-fpm')).toBe(false)
  })

  it('matches everything when empty', () => {
    expect(compiled({ text: '' }).matches('anything')).toBe(true)
  })

  it('excludes entries containing any exclusion term (case-insensitive)', () => {
    const s = compiled({ text: '', exclude: ['checagem de disponibilidade', 'kube-probe/'] })
    expect(s.excluded('"GET / HTTP/1.1" 200 "dashboard-okd (Checagem de Disponibilidade)"')).toBe(true)
    expect(s.excluded('"GET /healthz HTTP/1.1" 200 2 "-" "kube-probe/1.31"')).toBe(true)
    expect(s.excluded(P4)).toBe(false)
  })

  it('ignores blank exclusion terms', () => {
    expect(compiled({ text: '', exclude: ['', '  '] }).excluded('x')).toBe(false)
  })

  it('returns every match range', () => {
    expect(compiled({ text: 'out' }).ranges('timeout, timed out')).toEqual([
      [4, 7],
      [15, 18],
    ])
  })
})

describe('regex mode', () => {
  it('matches with the given pattern', () => {
    const s = compiled({ text: 'AH0107[15]|\\(70007\\)', mode: 'regex' })
    expect(s.matches(P4)).toBe(true)
    expect(s.matches('AH01071: Got error')).toBe(true)
    expect(s.matches('AH00489')).toBe(false)
  })

  it('reports invalid patterns instead of throwing', () => {
    expect(compileSearch({ text: '(', mode: 'regex' })).toMatchObject({ ok: false, error: 'invalid' })
  })

  it('rejects catastrophic patterns up front', () => {
    expect(compileSearch({ text: '(a+)+$', mode: 'regex' })).toMatchObject({ ok: false, error: 'unsafe' })
  })

  it('does not loop on zero-length matches', () => {
    expect(compiled({ text: 'x*', mode: 'regex' }).ranges('axxb')).toEqual([[1, 3]])
    expect(compiled({ text: '^', mode: 'regex' }).ranges('abc')).toEqual([])
  })
})

describe('isUnsafeRegex', () => {
  it.each(['(a+)+$', '(a*)*', '(\\w+)+x', '(.*)*', '([a-z]+)*$', '(a|b+)+', '(?:a+)+', '(?<word>a+)*', '(a+){2,}', '(a{2,})+', '((a+)b)+'])('flags %s', (p) => {
    expect(isUnsafeRegex(p)).toBe(true)
  })

  it.each([
    '(ab)+',
    'a+b+',
    '\\d{1,3}',
    'AH0107[15]',
    'timed? ?out',
    '(GET|POST) /api',
    '(a+){3}',
    '(a+){0,1}',
    '(a+)?',
    '[(]a+[)]+',
    '[^\\]]+x',
    '[]a]+',
    '\\(a+\\)+',
    '(?=a+)b',
    '(?<!x)y+',
    'a{,3}',
  ])('accepts %s', (p) => {
    expect(isUnsafeRegex(p)).toBe(false)
  })
})

describe('highlight', () => {
  it('splits text into plain segments without any markup', () => {
    expect(highlight('PHP-FPM and fpm', compiled({ text: 'fpm' }))).toEqual([
      { text: 'PHP-', match: false },
      { text: 'FPM', match: true },
      { text: ' and ', match: false },
      { text: 'fpm', match: true },
    ])
  })

  it('keeps HTML in log lines as literal text (G7)', () => {
    const segs = highlight('<img src=x onerror=alert(1)> error', compiled({ text: 'error' }))
    expect(segs.map((s) => s.text).join('')).toBe('<img src=x onerror=alert(1)> error')
  })

  it('returns one plain segment when there is no match', () => {
    expect(highlight('abc', compiled({ text: 'zzz' }))).toEqual([{ text: 'abc', match: false }])
  })
})

describe('filterEntries', () => {
  const es = [
    entry({ level: 'INFO', raw: '"GET / HTTP/1.1" 200 "dashboard-okd (checagem de disponibilidade)"' }),
    entry({ level: 'ERROR', raw: P4 }),
    entry({ level: 'WARN', raw: '[pool www] server reached pm.max_children' }),
    entry({ level: 'ERROR', raw: 'production.ERROR: boom', continuation: ['#0 /var/www/html/app/Fpm.php(1)'] }),
  ]

  it('filters by level set', () => {
    expect(filterEntries(es, { levels: new Set(['ERROR'] as const) })).toEqual([es[1], es[3]])
  })

  it('searches continuation lines too', () => {
    expect(entryText(es[3]!)).toContain('Fpm.php')
    expect(filterEntries(es, { search: compiled({ text: 'fpm.php' }) })).toEqual([es[3]])
  })

  it('combines level, search and exclusion', () => {
    const search = compiled({ text: 'error', exclude: ['boom'] })
    expect(filterEntries(es, { search, levels: new Set(['ERROR', 'WARN'] as const) })).toEqual([es[1]])
  })

  it('returns everything without filters', () => {
    expect(filterEntries(es, {})).toEqual(es)
  })

  it('searches 50k entries in under 100 ms (RNF4)', () => {
    const big = Array.from({ length: 50_000 }, (_, i) =>
      entry({ raw: i % 100 === 0 ? P4 : `10.0.0.${i % 250} - - "GET /x/${i} HTTP/1.1" 200 ${i}` }),
    )
    const search = compiled({ text: 'AH01075' })
    let best = Infinity
    for (let run = 0; run < 3; run++) {
      const t0 = performance.now()
      const out = filterEntries(big, { search })
      best = Math.min(best, performance.now() - t0)
      expect(out).toHaveLength(500)
    }
    expect(best).toBeLessThan(100)
  })
})

describe('searchWithTimeout (ReDoS protection, F5.4)', () => {
  it('applies case sensitivity and exclusions to regex searches', async () => {
    const texts = ['FPM down', 'fpm up', 'FPM probe']
    await expect(searchWithTimeout(texts, { text: 'FPM', mode: 'regex', caseSensitive: true, exclude: ['probe'] })).resolves.toEqual({
      status: 'ok',
      matches: [0],
    })
  })

  it('accepts a custom runner (renderer Web Worker)', async () => {
    const runner = async (texts: readonly string[], source: string, flags: string) => {
      expect([source, flags]).toEqual(['x', 'i'])
      return texts.map((_, i) => i)
    }
    await expect(searchWithTimeout(['a', 'b'], { text: 'x', mode: 'regex' }, { runner })).resolves.toEqual({ status: 'ok', matches: [0, 1] })
  })

  it('returns matching indexes for a normal search', async () => {
    await expect(searchWithTimeout(['a', 'FPM', 'b', 'php-fpm'], { text: 'fpm' })).resolves.toEqual({ status: 'ok', matches: [1, 3] })
  })

  it('rejects (a+)+$ immediately as unsafe', async () => {
    const r = await searchWithTimeout(['a'.repeat(50) + '!'], { text: '(a+)+$', mode: 'regex' })
    expect(r.status).toBe('unsafe')
  })

  it('reports invalid regex', async () => {
    expect((await searchWithTimeout(['x'], { text: '(', mode: 'regex' })).status).toBe('invalid')
  })

  it('aborts a pathological regex that slips past the static check, without hanging', async () => {
    const t0 = performance.now()
    const r = await searchWithTimeout(['a'.repeat(42) + '!'], { text: '(a|aa)+$', mode: 'regex' }, { timeoutMs: 250 })
    expect(r).toEqual({ status: 'timeout' })
    expect(performance.now() - t0).toBeLessThan(1500)
  })
})

describe('countExcluded (empty view: how many lines the presets hide)', () => {
  it('counts entries containing any term, case-insensitive, stack traces included', () => {
    const entries = [
      entry({ raw: '10.0.0.1 - - "GET /up HTTP/1.1" 200 2 "-" "kube-probe/1.29"' }),
      entry({ raw: '10.0.0.1 - - "GET /up HTTP/1.1" 200 2 "-" "Kube-Probe/1.29"' }),
      entry({ raw: 'job done' }),
      entry({ raw: 'trace', continuation: ['caused by GET /healthz'] }),
    ]
    expect(countExcluded(entries, ['kube-probe/', 'GET /healthz'])).toBe(3)
    expect(countExcluded(entries, [])).toBe(0)
  })
})
