import { todo } from '../../shared/todo'
import type { LineParser } from '../types'

export const accessParser: LineParser = {
  id: 'access',
  detect: (line) => todo(line),
  parse: (line) => todo(line),
}
