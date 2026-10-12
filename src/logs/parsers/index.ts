import type { LineParser, ParsedLine } from '../types'
import { accessParser } from './access'
import { apacheErrorParser } from './apache-error'
import { heuristicParser } from './heuristic'
import { jsonParser } from './json'
import { laravelParser } from './laravel'
import { nginxErrorParser } from './nginx-error'
import { phpFpmParser } from './php-fpm'
import { todo } from '../../shared/todo'

/** Tried in this order (SPEC P1). The heuristic parser is the last resort. */
export const PARSERS: readonly LineParser[] = [
  jsonParser,
  laravelParser,
  accessParser,
  apacheErrorParser,
  phpFpmParser,
  nginxErrorParser,
  heuristicParser,
]

export function parseLine(line: string): ParsedLine & { parser: string } {
  return todo(line)
}
