// Pod Shell (P5): `kubectl exec -it` inside a real pseudo-terminal, opened only by the user.
import { spawn, type IPty } from 'node-pty'
import { assertShellArgs, buildShellArgs, type PodTarget } from './args'
import { KubectlError, kubectlEnv, resolveExecutable, type KubectlOptions } from './kubectl'

export interface PodShellOptions {
  target: PodTarget
  cols: number
  rows: number
  kubectl?: KubectlOptions
  onData(data: string): void
  onExit(code: number): void
}

function clampSize(n: number, max: number): number {
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : 80
}

export class PodShell {
  private readonly pty: IPty
  private closed = false

  constructor(opts: PodShellOptions) {
    const args = buildShellArgs(opts.target)
    assertShellArgs(args)
    const env = kubectlEnv(opts.kubectl?.env ?? process.env)
    const binary = resolveExecutable(opts.kubectl?.binary ?? 'kubectl', env)
    if (!binary) throw new KubectlError('kubectl não encontrado. Instale com: brew install kubectl')
    this.pty = spawn(binary, args, {
      name: 'xterm-256color',
      cols: clampSize(opts.cols, 500),
      rows: clampSize(opts.rows, 200),
      env: env as Record<string, string>,
    })
    this.pty.onData(opts.onData)
    this.pty.onExit(({ exitCode }) => {
      this.closed = true
      opts.onExit(exitCode)
    })
  }

  get pid(): number {
    return this.pty.pid
  }

  write(data: string): void {
    if (!this.closed) this.pty.write(data)
  }

  /** Forwarded to the container by kubectl (SIGWINCH). */
  resize(cols: number, rows: number): void {
    if (!this.closed) this.pty.resize(clampSize(cols, 500), clampSize(rows, 200))
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.pty.kill()
  }
}

/** Every open shell, so that closing the tab or the app ends kubectl (F3.5). */
export class ShellRegistry {
  private readonly shells = new Map<string, PodShell>()
  private nextId = 1

  add(shell: PodShell): string {
    const id = `shell-${this.nextId++}`
    this.shells.set(id, shell)
    return id
  }

  get(id: string): PodShell | undefined {
    return this.shells.get(id)
  }

  close(id: string): void {
    this.shells.get(id)?.close()
    this.shells.delete(id)
  }

  closeAll(): void {
    for (const shell of this.shells.values()) shell.close()
    this.shells.clear()
  }

  get size(): number {
    return this.shells.size
  }
}
