import { buildGetContextsArgs } from './args'

export interface KubeContext {
  name: string
  cluster: string
  namespace?: string
  current: boolean
  /** Name contains `prod`/`prd` (G5). */
  production: boolean
}

export type RunKubectl = (args: string[]) => Promise<{ stdout: string; stderr: string; code: number }>

export function isProductionContext(name: string): boolean {
  return /prod|prd/i.test(name)
}

/**
 * Parses the table printed by `kubectl config get-contexts` (no credentials in it).
 * Columns are padded by kubectl, so header offsets locate every field.
 */
export function parseGetContexts(stdout: string): KubeContext[] {
  const lines = stdout.split('\n')
  const header = lines[0] ?? ''
  const nameAt = header.indexOf('NAME')
  const clusterAt = header.indexOf('CLUSTER')
  const authAt = header.indexOf('AUTHINFO')
  const nsAt = header.indexOf('NAMESPACE')
  if (nameAt < 0 || clusterAt < 0 || authAt < 0 || nsAt < 0) return []

  const contexts: KubeContext[] = []
  for (const line of lines.slice(1)) {
    if (line.trim() === '') continue
    const name = line.slice(nameAt, clusterAt).trim()
    if (!name) continue
    const ctx: KubeContext = {
      name,
      cluster: line.slice(clusterAt, authAt).trim(),
      current: line.slice(0, nameAt).trim() === '*',
      production: isProductionContext(name),
    }
    const namespace = line.slice(nsAt).trim()
    if (namespace) ctx.namespace = namespace
    contexts.push(ctx)
  }
  return contexts
}

export async function listContexts(run: RunKubectl): Promise<KubeContext[]> {
  const r = await run(buildGetContextsArgs())
  if (r.code !== 0) throw new Error(r.stderr.trim() || 'kubectl config get-contexts falhou')
  return parseGetContexts(r.stdout)
}
