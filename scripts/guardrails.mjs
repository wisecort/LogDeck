#!/usr/bin/env node
// Static checks for GUARDRAILS.md (G1–G10). No dependencies on purpose.
//
// Usage:
//   node scripts/guardrails.mjs              # exit 1 on violation
//   node scripts/guardrails.mjs --hook       # exit 2 on violation (Claude Code PostToolUse)
//   node scripts/guardrails.mjs --root <dir> # scan another tree (used by tests)

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const argv = process.argv.slice(2)
const hookMode = argv.includes('--hook')
const rootFlag = argv.indexOf('--root')
const ROOT = rootFlag >= 0 ? resolve(argv[rootFlag + 1]) : resolve(dirname(fileURLToPath(import.meta.url)), '..')

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|html)$/
const SKIP_DIRS = new Set(['node_modules', 'out', 'dist', 'release', 'coverage', '.git'])

const WRITE_VERBS = [
  'delete', 'apply', 'patch', 'scale', 'rollout', 'edit', 'cordon', 'drain', 'uncordon',
  'label', 'annotate', 'create', 'replace', 'set', 'expose', 'taint', 'autoscale',
]

const ALLOWED_FIXTURE_IP = /^(10\.0\.0\.(25[0-5]|2[0-4]\d|1?\d?\d)|127\.0\.0\.1|0\.0\.0\.0)$/
const ALLOWED_FIXTURE_HOST = /(^|\.)example\.(internal|com|org|net)$/i

/**
 * Line rules. `scope` is a path prefix (relative, posix); `except` lists files
 * where the pattern is legitimate.
 */
const RULES = [
  { id: 'G1-write-verb', scope: ['src/k8s/'], re: new RegExp(`['"\`](${WRITE_VERBS.join('|')})['"\`]`), msg: 'verbo de escrita do kubectl' },
  { id: 'G1-exec-scope', scope: ['src/'], except: ['src/k8s/args.ts', 'src/k8s/shell.ts'], re: /['"`]exec['"`]/, msg: "'exec' só em args.ts/shell.ts" },
  { id: 'G2-shell-true', scope: ['src/'], re: /\bshell\s*:\s*true\b/, msg: 'spawn com shell: true' },
  { id: 'G2-exec-template', scope: ['src/'], re: /\bexec(?:Sync)?\s*\(\s*`/, msg: 'exec com template string' },
  { id: 'G2-exec-template', scope: ['src/'], re: /\bexec(?:Sync)?\s*\([^)]*['"`]\s*\+/, msg: 'exec com concatenação de string' },
  { id: 'G2-child-process-scope', scope: ['src/'], except: ['src/k8s/'], re: /(from\s+|require\(\s*)['"](node:)?child_process['"]|(from\s+|require\(\s*)['"]node-pty['"]/, msg: 'child_process/node-pty fora de src/k8s/' },
  { id: 'G3-raw', scope: ['src/'], re: /--raw\b|--flatten\b/, msg: 'config view --raw/--flatten' },
  { id: 'G3-kubeconfig', scope: ['src/'], re: /\.kube[/\\]config|client-key-data|client-certificate-data|certificate-authority-data/, msg: 'acesso a kubeconfig/credenciais' },
  { id: 'G4-context-switch', scope: ['src/'], re: /\b(use-context|set-context)\b/, msg: 'troca de contexto global' },
  { id: 'G7-html-sink', scope: ['src/'], re: /dangerouslySetInnerHTML|\b(innerHTML|outerHTML)\s*=(?!=)|insertAdjacentHTML|document\.write\s*\(/, msg: 'renderização de HTML' },
  { id: 'G7-eval', scope: ['src/'], re: /(^|[^.\w])eval\s*\(|\bnew\s+Function\s*\(/, msg: 'eval/new Function' },
  { id: 'G8-secret', scope: ['src/', 'tests/fixtures/'], re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/, msg: 'JWT' },
  { id: 'G8-secret', scope: ['src/', 'tests/fixtures/'], re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/, msg: 'chave AWS' },
  { id: 'G8-secret', scope: ['src/', 'tests/fixtures/'], re: /-----BEGIN [A-Z ]*(PRIVATE KEY|CERTIFICATE)-----/, msg: 'chave/certificado PEM' },
  { id: 'G8-secret', scope: ['src/', 'tests/fixtures/'], re: /password\s*=\s*[^\s&"'*]/i, msg: 'password= com valor' },
  { id: 'G10-platform', scope: ['src/'], re: /['"](win32|linux)['"]/, msg: 'código para Windows/Linux (MVP 2)' },
]

const violations = []
let scanned = 0

function toPosix(p) {
  return p.split(sep).join('/')
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

function report(rule, file, line, detail) {
  violations.push({ rule, where: line ? `${file}:${line}` : file, detail })
}

function inScope(rel, rule) {
  if (!rule.scope.some((s) => rel.startsWith(s))) return false
  return !(rule.except ?? []).some((e) => (e.endsWith('/') ? rel.startsWith(e) : rel === e))
}

function scanLines(rel, text) {
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      if (inScope(rel, rule) && rule.re.test(line)) report(rule.id, rel, i + 1, rule.msg)
    }
    if (rel.startsWith('tests/fixtures/')) scanFixtureLine(rel, line, i + 1)
  })
}

function scanFixtureLine(rel, line, n) {
  for (const m of line.matchAll(/(?<![\d.])(\d{1,3}(?:\.\d{1,3}){3})(?![\d.])/g)) {
    if (!ALLOWED_FIXTURE_IP.test(m[1])) report('G8-fixture-ip', rel, n, `IP fora de 10.0.0.0/24: ${m[1]}`)
  }
  for (const m of line.matchAll(/\b((?:[a-z0-9-]+\.)+(?:com|br|gov|org|net|io|cloud|local))(?![\w-]|\.[a-z0-9])/gi)) {
    if (!ALLOWED_FIXTURE_HOST.test(m[1])) report('G8-fixture-host', rel, n, `host real: ${m[1]}`)
  }
}

function checkPackageJson() {
  const path = join(ROOT, 'package.json')
  if (!existsSync(path)) return
  const pkg = JSON.parse(readFileSync(path, 'utf8'))
  for (const key of ['win', 'linux', 'nsis', 'appImage', 'snap', 'deb', 'rpm']) {
    if (pkg.build?.[key]) report('G10-platform', 'package.json', 0, `alvo electron-builder "${key}" (MVP 2)`)
  }
  const docPath = join(ROOT, 'docs/dependencies.md')
  const doc = existsSync(docPath) ? readFileSync(docPath, 'utf8') : ''
  const documented = new Set([...doc.matchAll(/^\|\s*`([^`]+)`/gm)].map((m) => m[1]))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies }
  for (const name of Object.keys(deps)) {
    if (!documented.has(name)) report('G9-undocumented-dep', 'package.json', 0, `"${name}" sem justificativa em docs/dependencies.md`)
  }
}

function loadAllowlist() {
  const path = join(ROOT, 'scripts/guardrails.allow')
  const allowed = new Set()
  if (!existsSync(path)) return allowed
  readFileSync(path, 'utf8').split('\n').forEach((raw, i) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return
    const m = line.match(/^(\S+)\s+(\S+)\s+#\s*\S.*$/)
    if (!m) {
      report('allowlist', 'scripts/guardrails.allow', i + 1, 'formato: <caminho> <regra>  # justificativa obrigatória')
      return
    }
    allowed.add(`${m[1]} ${m[2]}`)
  })
  return allowed
}

const allowed = loadAllowlist()

for (const dir of ['src', 'tests/fixtures']) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = toPosix(relative(ROOT, file))
    if (rel.startsWith('src/') && !CODE_EXT.test(rel)) continue
    scanned++
    scanLines(rel, readFileSync(file, 'utf8'))
  }
}
checkPackageJson()

const remaining = violations.filter((v) => !allowed.has(`${v.where.split(':')[0]} ${v.rule}`))

if (remaining.length === 0) {
  console.log(`✅ guardrails: ${scanned} arquivos verificados, nenhuma violação`)
  process.exit(0)
}

const write = hookMode ? console.error : console.log
write(`❌ guardrails: ${remaining.length} violação(ões) — ver GUARDRAILS.md`)
for (const v of remaining) write(`  ${v.rule}  ${v.where}  ${v.detail}`)
process.exit(hookMode ? 2 : 1)
