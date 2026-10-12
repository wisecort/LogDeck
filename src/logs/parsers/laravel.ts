import { todo } from '../../shared/todo'
import type { LineParser } from '../types'

export const laravelParser: LineParser = {
  id: 'laravel',
  detect: (line) => todo(line),
  parse: (line) => todo(line),
}
