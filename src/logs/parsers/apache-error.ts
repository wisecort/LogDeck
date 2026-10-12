import { todo } from '../../shared/todo'
import type { LineParser } from '../types'

export const apacheErrorParser: LineParser = {
  id: 'apache-error',
  detect: (line) => todo(line),
  parse: (line) => todo(line),
}
