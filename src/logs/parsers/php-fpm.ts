import { todo } from '../../shared/todo'
import type { LineParser } from '../types'

export const phpFpmParser: LineParser = {
  id: 'php-fpm',
  detect: (line) => todo(line),
  parse: (line) => todo(line),
}
