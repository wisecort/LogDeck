// kubectl's default kubeconfig location. Only handed to kubectl inside KUBECONFIG, next to the files the user
// added; the app never opens it (G3, exception in scripts/guardrails.allow).
import { posix, win32 } from 'node:path'
import type { Platform } from './paths'

export function defaultKubeconfigPath(home: string, platform: Platform): string {
  return platform === 'win32' ? win32.join(home, '.kube\\config') : posix.join(home, '.kube/config')
}

export const kubeconfigDelimiter = (platform: Platform) => (platform === 'win32' ? ';' : ':')

export const joinPath = (platform: Platform, dir: string, name: string) => (platform === 'win32' ? win32 : posix).join(dir, name)
