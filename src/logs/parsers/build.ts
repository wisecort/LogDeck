// OKD/OpenShift build pods (buildah/docker strategy, s2i): STEP lines, layer ids, image push, git clone.
// Lines of RUN output have no format: the session default level (INFO for build pods) applies to them.
import type { Level, LineParser, ParsedLine } from '../types'

const STEP = /^STEP (\d+\/\d+): ([A-Z]+)\b\s*(.*)$/
const RULES: ReadonlyArray<[RegExp, Level]> = [
  [/^(?:error|ERRO|ERROR|Error)\b[:!]/, 'ERROR'],
  [/^error building\b|^Error: (?:building|error building)\b/i, 'ERROR'],
  [/^(?:warning|WARN|WARNING)\b[:!]/, 'WARN'],
  [/^--> (?:[0-9a-f]{6,}|Using cache\b)/, 'DEBUG'],
  [/^(?:Getting image source signatures|Copying (?:blob|config) |Writing manifest to image destination|Storing signatures)/, 'DEBUG'],
  [
    /^(?:COMMIT |Successfully (?:tagged|pushed|built) |Push successful|Pushing image |Cloning "|(?:Commit|Author|Date|Message):\t|Adding cluster TLS certificate authority|Caching blobs under|Trying to pull |Replaced Dockerfile FROM image)/,
    'INFO',
  ],
]

export const buildParser: LineParser = {
  id: 'build',
  detect: (line) => STEP.test(line) || RULES.some(([re]) => re.test(line.trimStart())),
  parse(line): ParsedLine | null {
    const step = STEP.exec(line)
    if (step) return { level: 'INFO', message: `${step[2]} ${step[3]}`.trim(), fields: { step: step[1]!, instruction: step[2]! } }
    const text = line.trimStart()
    const rule = RULES.find(([re]) => re.test(text))
    return rule ? { level: rule[1], message: text } : null
  },
}
