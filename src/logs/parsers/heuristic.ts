import { todo } from '../../shared/todo'
import type { LineParser } from '../types'

export const heuristicParser: LineParser = {
  id: 'heuristic',
  detect: (line) => todo(line),
  parse: (line) => todo(line),
}
