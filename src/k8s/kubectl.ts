// Single place that spawns kubectl (G2): argv array, shell: false, allowlist checked first.
import { spawn, type ChildProcess } from 'node:child_process'
import { assertReadOnly } from './args'

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
}

const EXTRA_PATHS = ['/opt/homebrew/bin', '/usr/local/bin']
const DEFAULT_TIMEOUT_MS = 30_000

/** Apps opened from Finder get a minimal PATH; add Homebrew so kubectl and auth plugins resolve. */
export function kubectlEnv(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const parts = (base['PATH'] ?? '').split(':').filter(Boolean)
  for (const p of EXTRA_PATHS) if (!parts.includes(p)) parts.push(p)
  return { ...base, PATH: parts.join(':') }
}

const MESSAGES: ReadonlyArray<[RegExp, string]> = [
  [/Unauthorized|must be logged in|token has expired|provide credentials/i, 'Sessão expirada ou sem login. Rode `oc login` (OKD) ou renove as credenciais do contexto no terminal.'],
  [/Forbidden|forbidden/, 'Sem permissão para esta ação no cluster (RBAC).'],
  [/Unable to connect|no such host|connection refused|i\/o timeout|handshake timeout|EOF$/i, 'Cluster inacessível. Verifique VPN/rede e o endereço do contexto.'],
  [/NotFound|not found/i, 'Recurso não encontrado (o pod pode ter sido removido ou recriado).'],
  [/context .* does not exist/i, 'Contexto não existe no kubeconfig.'],
]

/** Actionable Portuguese message for common kubectl failures (F1.5). */
export function friendlyError(stderrOrError: string | NodeJS.ErrnoException): string {
  if (typeof stderrOrError !== 'string') {
    if (stderrOrError.code === 'ENOENT') return 'kubectl não encontrado. Instale com: brew install kubectl'
    stderrOrError = stderrOrError.message
  }
  const text = stderrOrError.trim()
  const hit = MESSAGES.find(([re]) => re.test(text))
  return hit ? `${hit[1]} (${text.split('\n')[0]})` : text
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
      reject(new KubectlError(`kubectl: tempo esgotado após ${opts.timeoutMs ?? DEFAULT_TIMEOUT_MS} ms`))
    }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(new KubectlError(friendlyError(err)))
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ stdout, stderr, code: code ?? 1 })
    })
  })
}
