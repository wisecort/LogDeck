import { todo } from '../../shared/todo'
import type { LineParser } from '../types'

export const jsonParser: LineParser = {
  id: 'json',
  detect: (line) => todo(line),
  parse: (line) => todo(line),
}
