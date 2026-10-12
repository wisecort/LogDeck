import { describe, expect, it } from 'vitest'
import { aroundEntry, visibleLines } from '../../src/ui/ai-context'
import { entry } from '../helpers/entries'

const es = Array.from({ length: 50 }, (_, i) => entry({ raw: `line ${i}`, level: i === 25 ? 'ERROR' : 'INFO' }))

describe('AI context builders (block B)', () => {
  it('sends the selected line with the lines around it, marking it', () => {
    const g = aroundEntry(es, es[25]!.seq, 3)
    expect(g.title).toBe('Linha selecionada (ERROR) com 3 linhas antes e depois')
    expect(g.lines).toEqual(['line 22', 'line 23', 'line 24', '>>> line 25', 'line 26', 'line 27', 'line 28'])
  })

  it('clips at the edges of the buffer', () => {
    expect(aroundEntry(es, es[0]!.seq, 2).lines).toEqual(['>>> line 0', 'line 1', 'line 2'])
  })

  it('includes stack-trace lines of the selected entry', () => {
    const withStack = [entry({ raw: 'boom', level: 'ERROR', continuation: ['#0 a.php(1)'] })]
    expect(aroundEntry(withStack, withStack[0]!.seq, 2).lines).toEqual(['>>> boom\n#0 a.php(1)'])
  })

  it('throws for an unknown entry', () => {
    expect(() => aroundEntry(es, -1, 2)).toThrow()
  })

  it('sends the most recent visible lines', () => {
    const g = visibleLines(es, 10)
    expect(g).toEqual({ title: 'Linhas visíveis no filtro atual', count: 50, lines: es.slice(40).map((e) => e.raw) })
  })
})
