// Everything that differs between macOS, Linux and Windows when finding executables (G10: platform code lives here).
import { accessSync, constants } from 'node:fs'
import { join, posix, win32 } from 'node:path'

export type Platform = 'darwin' | 'linux' | 'win32'

export const currentPlatform = (): Platform => (process.platform === 'win32' ? 'win32' : process.platform === 'linux' ? 'linux' : 'darwin')

const pathMod = (platform: Platform) => (platform === 'win32' ? win32 : posix)
const delimiter = (platform: Platform) => (platform === 'win32' ? ';' : ':')

/** Windows env keys are case-insensitive ("Path"); a copied object is not, so find the real key. */
function pathKey(env: NodeJS.ProcessEnv, platform: Platform): string {
  if (platform !== 'win32') return 'PATH'
  return Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'Path'
}

export function envPath(env: NodeJS.ProcessEnv, platform: Platform = currentPlatform()): string {
  return env[pathKey(env, platform)] ?? ''
}

/** Where kubectl, cloud auth plugins (aws, gke-gcloud-auth-plugin, oc) and the claude CLI are usually installed. */
export function extraBinDirs(platform: Platform, home: string): string[] {
  const j = pathMod(platform).join
  if (platform === 'darwin') return ['/opt/homebrew/bin', '/usr/local/bin', j(home, '.local/bin')]
  if (platform === 'linux') return ['/usr/local/bin', '/snap/bin', '/home/linuxbrew/.linuxbrew/bin', j(home, '.local/bin')]
  return [j(home, '.local', 'bin'), j(home, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Links')]
}

/** Apps opened from the Finder/Start menu get a minimal PATH; append the usual install dirs. */
export function withExtraPaths(base: NodeJS.ProcessEnv, platform: Platform, home: string): NodeJS.ProcessEnv {
  const key = pathKey(base, platform)
  const parts = (base[key] ?? '').split(delimiter(platform)).filter(Boolean)
  for (const dir of extraBinDirs(platform, home)) if (!parts.includes(dir)) parts.push(dir)
  return { ...base, [key]: parts.join(delimiter(platform)) }
}

/** Absolute path of `name` in the env PATH. On Windows only .exe/.com: .cmd/.bat would need a shell (G2). */
export function resolveExecutable(name: string, env: NodeJS.ProcessEnv, platform: Platform = currentPlatform()): string | undefined {
  if (pathMod(platform).isAbsolute(name)) return name
  const names = platform === 'win32' ? (/\.(exe|com)$/i.test(name) ? [name] : [`${name}.exe`, `${name}.com`]) : [name]
  for (const dir of envPath(env, platform).split(delimiter(platform)).filter(Boolean)) {
    for (const n of names) {
      // native join: on a real Windows host this is win32.join
      const candidate = join(dir, n)
      try {
        accessSync(candidate, platform === 'win32' ? constants.F_OK : constants.X_OK)
        return candidate
      } catch {
        // keep looking
      }
    }
  }
  return undefined
}

export function kubectlInstallHint(platform: Platform = currentPlatform()): string {
  if (platform === 'darwin') return 'brew install kubectl'
  if (platform === 'linux') return 'sudo snap install kubectl --classic (ou o pacote kubectl da sua distribuição)'
  return 'winget install -e --id Kubernetes.kubectl'
}
