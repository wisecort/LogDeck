import { todo } from '../shared/todo'

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
  return todo(name)
}

/** Parses the table printed by `kubectl config get-contexts` (no credentials in it). */
export function parseGetContexts(stdout: string): KubeContext[] {
  return todo(stdout)
}

export async function listContexts(run: RunKubectl): Promise<KubeContext[]> {
  return todo(run)
}
