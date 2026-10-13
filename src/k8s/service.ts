import {
  buildCanIArgs,
  buildGetNamespacesArgs,
  buildGetPodsArgs,
  buildGetBuildsArgs,
  buildVersionArgs,
  validateContextName,
  validateNamespace,
  type Target,
} from './args'
import { listContexts, type KubeContext } from './contexts'
import { friendlyError, KubectlError, runKubectl, type KubectlOptions, type KubectlResult } from './kubectl'
import { kubectlInstallHint } from '../platform/paths'
import type { NamespaceList, VersionInfo } from '../shared/ipc'
import { parseNamespaces, parsePods, type PodSummary } from './pods'
import { parseBuilds, type BuildSummary } from './builds'

export type { NamespaceList, VersionInfo } from '../shared/ipc'

/** Read-only navigation: contexts → namespaces → pods (F1, F2). */
export class K8sService {
  private contextList: KubeContext[] = []

  constructor(private readonly opts: KubectlOptions = {}) {}

  get knownContexts(): readonly string[] {
    return this.contextList.map((c) => c.name)
  }

  private run(args: string[]): Promise<KubectlResult> {
    return runKubectl(args, this.opts)
  }

  private async ok(args: string[]): Promise<string> {
    const r = await this.run(args)
    if (r.code !== 0) throw new KubectlError(friendlyError(r.stderr))
    return r.stdout
  }

  /** Resolves a context against the list from `config get-contexts` (loaded once, on demand). */
  private async target(context: string): Promise<Target> {
    if (this.contextList.length === 0) await this.contexts()
    validateContextName(context, this.knownContexts)
    return { context, knownContexts: this.knownContexts }
  }

  async version(): Promise<VersionInfo> {
    try {
      const out = await this.ok(buildVersionArgs())
      const parsed = JSON.parse(out) as { clientVersion?: { gitVersion?: string } }
      return { installed: true, version: parsed.clientVersion?.gitVersion ?? 'desconhecida' }
    } catch (err) {
      const missing = err instanceof KubectlError && err.missing
      return { installed: false, message: (err as Error).message, ...(missing && { missing: true, installHint: kubectlInstallHint() }) }
    }
  }

  async contexts(): Promise<KubeContext[]> {
    try {
      this.contextList = await listContexts((args) => this.run(args))
    } catch (err) {
      throw err instanceof KubectlError ? err : new KubectlError(friendlyError((err as Error).message))
    }
    return this.contextList
  }

  async namespaces(context: string): Promise<NamespaceList> {
    const target = await this.target(context)
    const defaultNamespace = this.contextList.find((c) => c.name === context)?.namespace
    const canI = await this.run(buildCanIArgs({ ...target, verb: 'list', resource: 'namespaces' }))
    if (canI.stdout.trim() !== 'yes') {
      return { namespaces: defaultNamespace ? [defaultNamespace] : [], canList: false, ...(defaultNamespace && { defaultNamespace }) }
    }
    const namespaces = parseNamespaces(await this.ok(buildGetNamespacesArgs(target)))
    return { namespaces, canList: true, ...(defaultNamespace && { defaultNamespace }) }
  }

  async pods(context: string, namespace: string): Promise<PodSummary[]> {
    const target = await this.target(context)
    validateNamespace(namespace)
    return parsePods(await this.ok(buildGetPodsArgs({ ...target, namespace })))
  }

  /** OKD/OpenShift builds of a namespace; [] on clusters without the API or without RBAC (never an error). */
  async builds(context: string, namespace: string): Promise<BuildSummary[]> {
    const target = await this.target(context)
    validateNamespace(namespace)
    const r = await this.run(buildGetBuildsArgs({ ...target, namespace }))
    if (r.code !== 0) return []
    try {
      return parseBuilds(r.stdout)
    } catch {
      return []
    }
  }
}
