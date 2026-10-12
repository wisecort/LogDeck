import { todo } from '../../shared/todo'
import type { LineParser } from '../types'

export const nginxErrorParser: LineParser = {
  id: 'nginx-error',
  detect: (line) => todo(line),
  parse: (line) => todo(line),
}
