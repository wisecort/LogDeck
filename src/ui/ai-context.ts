// What the AI tab sends (block B): a line with its neighbours, or the lines visible in the filter.
import { entryText } from '../logs/search'
import type { LogEntry } from '../logs/types'
import type { ExplainGroupInput } from '../shared/ai'

export function aroundEntry(entries: readonly LogEntry[], seq: number, radius: number): ExplainGroupInput {
  const i = entries.findIndex((e) => e.seq === seq)
  if (i < 0) throw new Error('linha não está mais no buffer')
  const slice = entries.slice(Math.max(0, i - radius), i + radius + 1)
  return {
    title: `Linha selecionada (${entries[i]!.level}) com ${radius} linhas antes e depois`,
    count: 1,
    lines: slice.map((e) => (e.seq === seq ? `>>> ${entryText(e)}` : entryText(e))),
  }
}

export function visibleLines(entries: readonly LogEntry[], limit: number): ExplainGroupInput {
  return { title: 'Linhas visíveis no filtro atual', count: entries.length, lines: entries.slice(-limit).map(entryText) }
}
