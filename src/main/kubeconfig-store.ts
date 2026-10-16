import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { sanitizeKubeconfigSettings } from '../k8s/kubeconfig'
import type { KubeconfigSettings } from '../shared/ipc'

/** JSON file in userData with the kubeconfig files and folders the user added (paths only, F1.6). */
export class KubeconfigStore {
  private data: KubeconfigSettings = { useDefault: true, sources: [] }

  constructor(private readonly file: string) {
    if (!existsSync(file)) return
    try {
      this.data = sanitizeKubeconfigSettings(JSON.parse(readFileSync(file, 'utf8')))
    } catch {
      // unreadable file: start with the default kubeconfig only
    }
  }

  get(): KubeconfigSettings {
    return this.data
  }

  set(value: KubeconfigSettings): KubeconfigSettings {
    this.data = sanitizeKubeconfigSettings(value)
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.data, null, 2))
    renameSync(tmp, this.file)
    return this.data
  }
}
