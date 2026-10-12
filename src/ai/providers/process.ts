// Small spawn helper for provider CLIs (claude, security). argv array, never a shell (G2).
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { currentPlatform, withExtraPaths } from '../../platform/paths'

export interface RunResult {
  code: number
  stdout: string
  stderr: string
}

export interface RunOptions {
  env?: NodeJS.ProcessEnv
  cwd?: string
  input?: string
  timeoutMs?: number
}

export class ProcessTimeoutError extends Error {}

/** Finder-launched apps get a minimal PATH; add where CLIs are usually installed. */
export function cliEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return withExtraPaths(base, currentPlatform(), homedir())
}

export function runProcess(binary: string, args: readonly string[], opts: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { shell: false, env: cliEnv(opts.env), cwd: opts.cwd, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let timer: ReturnType<typeof setTimeout> | undefined
    child.stdout.setEncoding('utf8').on('data', (d: string) => (stdout += d))
    child.stderr.setEncoding('utf8').on('data', (d: string) => (stderr += d))
    child.on('error', (err) => {
      if (timer) clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      if (timer) clearTimeout(timer)
      resolve({ code: code ?? 1, stdout, stderr })
    })
    if (opts.timeoutMs) {
      timer = setTimeout(() => {
        child.kill('SIGKILL')
        reject(new ProcessTimeoutError(`tempo esgotado após ${opts.timeoutMs} ms`))
      }, opts.timeoutMs)
    }
    child.stdin.on('error', () => {}) // the process may exit before reading stdin
    child.stdin.end(opts.input ?? '')
  })
}
