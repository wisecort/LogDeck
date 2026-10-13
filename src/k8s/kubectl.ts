// Single place that spawns kubectl (G2): argv array, shell: false, allowlist checked first.
import { spawn, type ChildProcess } from 'node:child_process'
import { homedir } from 'node:os'
import { currentPlatform, kubectlInstallHint, resolveExecutable as resolveIn, withExtraPaths, type Platform } from '../platform/paths'
import { assertReadOnly } from './args'
import { messagesLanguage, PATTERNS, texts } from './messages'

export interface KubectlOptions {
  /** Binary name or path; default `kubectl` resolved from PATH. */
  binary?: string
  env?: NodeJS.ProcessEnv
  timeoutMs?: number
}

export interface KubectlResult {
  stdout: string
  stderr: string
  code: number
}

export class KubectlError extends Error {
  override name = 'KubectlError'
  /** kubectl itself is not installed (spawn ENOENT), as opposed to a kubectl that ran and failed. */
  missing = false
}

/** client-go: "getting credentials: exec: executable aws not found". */
const MISSING_PLUGIN = /executable (\S+) not found/i

const DEFAULT_TIMEOUT_MS = 30_000

/** Apps opened from the Finder/Start menu get a minimal PATH; add the usual dirs so kubectl and auth plugins resolve. */
export function kubectlEnv(base: NodeJS.ProcessEnv, platform: Platform = currentPlatform()): NodeJS.ProcessEnv {
  return withExtraPaths(base, platform, base['HOME'] ?? base['USERPROFILE'] ?? homedir())
}

/** Actionable message for common kubectl failures (F1.5), in the interface language. */
export function friendlyError(stderrOrError: string | NodeJS.ErrnoException, platform: Platform = currentPlatform(), lang: string = messagesLanguage()): string {
  const tx = texts(lang)
  if (typeof stderrOrError !== 'string') {
    if (stderrOrError.code === 'ENOENT') return tx.missing.replace('{hint}', kubectlInstallHint(platform))
    stderrOrError = stderrOrError.message
  }
  const text = stderrOrError.trim()
  const plugin = MISSING_PLUGIN.exec(text)
  if (plugin) return tx.plugin.replace('{name}', plugin[1]!)
  const hit = PATTERNS.find(([re]) => re.test(text))
  return hit ? `${tx[hit[1]]} (${text.split('\n')[0]})` : text
}

/** Timeout in the interface language, naming the command that hung (`get pods`, never the context). */
export function timeoutMessage(args: readonly string[], ms: number, lang: string = messagesLanguage()): string {
  const cmd = args.filter((a) => !a.startsWith('-')).slice(0, 2).join(' ')
  return texts(lang).timeout.replace('{s}', String(Math.round(ms / 1000))).replace('{cmd}', `kubectl ${cmd}`)
}

/** Absolute path of `name` in env PATH (node-pty does not search the PATH we pass). */
export function resolveExecutable(name: string, env: NodeJS.ProcessEnv): string | undefined {
  return resolveIn(name, env)
}

export function spawnKubectl(args: string[], opts: KubectlOptions = {}): ChildProcess {
  assertReadOnly(args)
  return spawn(opts.binary ?? 'kubectl', args, {
    shell: false,
    env: kubectlEnv(opts.env ?? process.env),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

export function runKubectl(args: string[], opts: KubectlOptions = {}): Promise<KubectlResult> {
  return new Promise((resolve, reject) => {
    let child: ChildProcess
    try {
      child = spawnKubectl(args, opts)
    } catch (err) {
      reject(err)
      return
    }
    let stdout = ''
    let stderr = ''
    child.stdout!.setEncoding('utf8').on('data', (d: string) => (stdout += d))
    child.stderr!.setEncoding('utf8').on('data', (d: string) => (stderr += d))
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new KubectlError(timeoutMessage(args, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)))
    }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    child.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      const error = new KubectlError(friendlyError(err))
      error.missing = err.code === 'ENOENT'
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ stdout, stderr, code: code ?? 1 })
    })
  })
}
