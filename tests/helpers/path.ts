import { delimiter } from 'node:path'

/** The PATH key of an env object ("Path" on Windows: a copied object is case-sensitive). */
export function pathKey(env: NodeJS.ProcessEnv): string {
  return Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH'
}

/** Copy of env with `dir` first in the PATH, keeping the existing key. */
export function withPathFirst(env: NodeJS.ProcessEnv, dir: string): NodeJS.ProcessEnv {
  const key = pathKey(env)
  return { ...env, [key]: `${dir}${delimiter}${env[key] ?? ''}` }
}
