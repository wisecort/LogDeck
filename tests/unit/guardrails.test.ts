import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const SCRIPT = resolve(__dirname, '../../scripts/guardrails.mjs')

// Secret-looking samples are assembled at runtime so that gitleaks does not
// flag this test file itself.
const FAKE_JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', 'c2lnbmF0dXJl'].join('.')
const FAKE_AWS = 'AKIA' + 'ABCDEFGHIJKLMNOP'
const FAKE_PEM = '-----' + 'BEGIN RSA PRIVATE KEY' + '-----'
const FAKE_PASSWORD = 'pass' + 'word=hunter2'

let roots: string[] = []

type Files = Record<string, string>

const BASE: Files = {
  'package.json': JSON.stringify({
    name: 'fake',
    dependencies: { react: '1.0.0' },
    devDependencies: { vitest: '1.0.0' },
    build: { mac: {} },
  }),
  'docs/dependencies.md': '| `react` | x |\n| `vitest` | x |\n',
  'src/logs/clean.ts': 'export const answer = 42\n',
  'src/k8s/args.ts': "export const VERBS = ['get', 'logs', 'exec']\n",
  'tests/fixtures/apache.log':
    '10.0.0.2 - - [09/Oct/2026:03:26:40 +0000] "GET / HTTP/1.1" 200 19340 "-" "probe"\n' +
    '127.0.0.1 api.example.internal ok\n',
}

function project(extra: Files = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'logdeck-guardrails-'))
  roots.push(root)
  for (const [path, content] of Object.entries({ ...BASE, ...extra })) {
    const full = join(root, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  return root
}

function run(root: string, ...flags: string[]) {
  const r = spawnSync(process.execPath, [SCRIPT, '--root', root, ...flags], { encoding: 'utf8' })
  return { code: r.status, out: `${r.stdout}${r.stderr}` }
}

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
  roots = []
})

describe('guardrails.mjs', () => {
  it('passes on a clean project', () => {
    const r = run(project())
    expect(r.out).toContain('✅')
    expect(r.code).toBe(0)
  })

  const dirty: Array<[string, string, string]> = [
    ['G1-write-verb', 'src/k8s/scale.ts', "const args = ['scale', 'deploy/x']\n"],
    ['G1-write-verb', 'src/k8s/del.ts', 'const verb = "delete"\n'],
    ['G1-exec-scope', 'src/k8s/other.ts', "const verb = 'exec'\n"],
    ['G2-shell-true', 'src/k8s/kubectl.ts', 'spawn(cmd, args, { shell: true })\n'],
    ['G2-exec-template', 'src/k8s/kubectl.ts', 'execSync(`kubectl logs ${pod}`)\n'],
    ['G2-exec-template', 'src/k8s/kubectl.ts', "exec('kubectl get ' + ns)\n"],
    ['G2-child-process-scope', 'src/ui/App.tsx', "import { spawn } from 'node:child_process'\n"],
    ['G3-raw', 'src/k8s/contexts.ts', "const a = ['config', 'view', '--raw']\n"],
    ['G3-kubeconfig', 'src/k8s/contexts.ts', "readFileSync(home + '/.kube/config')\n"],
    ['G3-kubeconfig', 'src/k8s/contexts.ts', 'const k = cfg["client-key-data"]\n'],
    ['G4-context-switch', 'src/k8s/contexts.ts', "const a = ['config', 'use-context', name]\n"],
    ['G7-html-sink', 'src/ui/Line.tsx', '<div dangerouslySetInnerHTML={{ __html: line }} />\n'],
    ['G7-html-sink', 'src/ui/line.ts', 'el.innerHTML = line\n'],
    ['G7-eval', 'src/ui/line.ts', 'eval(code)\n'],
    ['G7-eval', 'src/ui/line.ts', 'const f = new Function("return 1")\n'],
    ['G8-secret', 'src/ai/explain.ts', `const t = "${FAKE_JWT}"\n`],
    ['G8-secret', 'tests/fixtures/aws.log', `key ${FAKE_AWS}\n`],
    ['G8-secret', 'tests/fixtures/pem.log', `${FAKE_PEM}\n`],
    ['G8-secret', 'tests/fixtures/pw.log', `login ${FAKE_PASSWORD}\n`],
    ['G8-fixture-ip', 'tests/fixtures/ip.log', '192.168.1.10 - - "GET / HTTP/1.1" 200\n'],
    ['G8-fixture-ip', 'tests/fixtures/ip.log', '10.129.2.2 - - "GET / HTTP/1.1" 200\n'],
    ['G8-fixture-host', 'tests/fixtures/host.log', 'upstream: app.realcompany.com.br\n'],
    ['G10-platform', 'src/main/index.ts', "if (process.platform === 'win32') {}\n"],
  ]

  it.each(dirty)('fails with %s for %s', (rule, path, content) => {
    const r = run(project({ [path]: content }))
    expect(r.code).toBe(1)
    expect(r.out).toContain(rule)
    expect(r.out).toContain(path)
  })

  it('does not mistake Java package names for hosts in fixtures', () => {
    const r = run(project({ 'tests/fixtures/java.log': 'Caused by: java.net.SocketTimeoutException: Connect timed out\n' }))
    expect(r.out).not.toContain('G8-fixture-host')
    expect(r.code).toBe(0)
  })

  it('reports the offending line number', () => {
    const r = run(project({ 'src/ui/line.ts': 'const a = 1\nel.innerHTML = x\n' }))
    expect(r.out).toContain('src/ui/line.ts:2')
  })

  it('fails when a dependency is not documented (G9)', () => {
    const pkg = JSON.parse(BASE['package.json']!)
    pkg.dependencies['left-pad'] = '1.0.0'
    const r = run(project({ 'package.json': JSON.stringify(pkg) }))
    expect(r.code).toBe(1)
    expect(r.out).toContain('G9-undocumented-dep')
    expect(r.out).toContain('left-pad')
  })

  it('fails when electron-builder targets Windows or Linux (G10)', () => {
    const pkg = JSON.parse(BASE['package.json']!)
    pkg.build.linux = { target: 'AppImage' }
    const r = run(project({ 'package.json': JSON.stringify(pkg) }))
    expect(r.code).toBe(1)
    expect(r.out).toContain('G10-platform')
  })

  it('exits with 2 in --hook mode so Claude Code sees the violation', () => {
    const r = run(project({ 'src/ui/line.ts': 'eval(x)\n' }), '--hook')
    expect(r.code).toBe(2)
  })

  it('honours a justified allowlist entry', () => {
    const root = project({
      'src/ui/line.ts': 'eval(x)\n',
      'scripts/guardrails.allow': 'src/ui/line.ts G7-eval  # sandboxed sample for docs\n',
    })
    expect(run(root).code).toBe(0)
  })

  it('rejects an allowlist entry without justification', () => {
    const root = project({
      'src/ui/line.ts': 'eval(x)\n',
      'scripts/guardrails.allow': 'src/ui/line.ts G7-eval\n',
    })
    const r = run(root)
    expect(r.code).toBe(1)
    expect(r.out).toContain('guardrails.allow')
  })
})
