import type { LineParser, ParsedLine } from '../types'
import { accessParser } from './access'
import { apacheErrorParser } from './apache-error'
import { buildParser } from './build'
import { heuristicParser } from './heuristic'
import { jsonParser } from './json'
import { laravelParser } from './laravel'
import { nginxErrorParser } from './nginx-error'
import { phpFpmParser } from './php-fpm'

/** Tried in this order (SPEC P1). The heuristic parser is the last resort. */
export const PARSERS: readonly LineParser[] = [
  jsonParser,
  laravelParser,
  accessParser,
  apacheErrorParser,
  phpFpmParser,
  nginxErrorParser,
  buildParser,
  heuristicParser,
]

export function parseLine(line: string): ParsedLine & { parser: string } {
  for (const parser of PARSERS) {
    if (parser === heuristicParser || !parser.detect(line)) continue
    const parsed = parser.parse(line)
    if (parsed) return { ...parsed, parser: parser.id }
  }
  return { ...heuristicParser.parse(line)!, parser: heuristicParser.id }
}
