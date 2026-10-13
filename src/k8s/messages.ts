// Actionable messages for common kubectl failures (F1.5), in the interface language chosen in Preferências.
// main sets the language through app:set-language; pt-BR until then.

type Kind = 'auth' | 'forbidden' | 'unreachable' | 'notFound' | 'noContext'

export const PATTERNS: ReadonlyArray<[RegExp, Kind]> = [
  [/Unauthorized|must be logged in|token has expired|provide credentials/i, 'auth'],
  [/Forbidden|forbidden/, 'forbidden'],
  [/Unable to connect|no such host|connection refused|i\/o timeout|handshake timeout|EOF$/i, 'unreachable'],
  [/NotFound|not found/i, 'notFound'],
  [/context .* does not exist/i, 'noContext'],
]

interface Texts extends Record<Kind, string> {
  missing: string
  /** {name}: the credential plugin the kubeconfig calls (oc, aws, gke-gcloud-auth-plugin, kubelogin…). */
  plugin: string
  /** {s} seconds, {cmd} e.g. "get pods". */
  timeout: string
}

const TEXTS: Record<string, Texts> = {
  'pt-BR': {
    auth: 'Sessão expirada ou sem login. Rode `oc login` (OKD) ou renove as credenciais do contexto no terminal.',
    forbidden: 'Sem permissão para esta ação no cluster (RBAC).',
    unreachable: 'Cluster inacessível. Verifique VPN/rede e o endereço do contexto.',
    notFound: 'Recurso não encontrado (o pod pode ter sido removido ou recriado).',
    noContext: 'Contexto não existe no kubeconfig.',
    missing: 'kubectl não encontrado. Instale com: {hint}',
    plugin: 'Plugin de login `{name}` não encontrado. O kubeconfig deste contexto usa esse programa para entrar no cluster: instale-o ou confira se a pasta dele está no PATH.',
    timeout: 'O cluster não respondeu em {s} s ({cmd}). Verifique a VPN/rede e se o login do contexto ainda vale (oc login, aws sso login…).',
  },
  'pt-PT': {
    auth: 'Sessão expirada ou sem início de sessão. Execute `oc login` (OKD) ou renove as credenciais do contexto no terminal.',
    forbidden: 'Sem permissão para esta ação no cluster (RBAC).',
    unreachable: 'Cluster inacessível. Verifique a VPN/rede e o endereço do contexto.',
    notFound: 'Recurso não encontrado (o pod pode ter sido removido ou recriado).',
    noContext: 'O contexto não existe no kubeconfig.',
    missing: 'kubectl não encontrado. Instale com: {hint}',
    plugin: 'Plugin de início de sessão `{name}` não encontrado. O kubeconfig deste contexto usa esse programa para aceder ao cluster: instale-o ou verifique se a pasta dele está no PATH.',
    timeout: 'O cluster não respondeu em {s} s ({cmd}). Verifique a VPN/rede e se a sessão do contexto ainda é válida (oc login, aws sso login…).',
  },
  en: {
    auth: 'Session expired or not logged in. Run `oc login` (OKD) or renew the context credentials in a terminal.',
    forbidden: 'No permission for this action in the cluster (RBAC).',
    unreachable: 'Cluster unreachable. Check the VPN/network and the context address.',
    notFound: 'Resource not found (the pod may have been removed or recreated).',
    noContext: 'Context does not exist in the kubeconfig.',
    missing: 'kubectl not found. Install it with: {hint}',
    plugin: 'Login plugin `{name}` not found. This context\'s kubeconfig uses it to sign in to the cluster: install it or check that its folder is in the PATH.',
    timeout: 'The cluster did not answer within {s} s ({cmd}). Check the VPN/network and whether the context login is still valid (oc login, aws sso login…).',
  },
  es: {
    auth: 'Sesión caducada o sin iniciar. Ejecute `oc login` (OKD) o renueve las credenciales del contexto en una terminal.',
    forbidden: 'Sin permiso para esta acción en el clúster (RBAC).',
    unreachable: 'Clúster inaccesible. Revise la VPN/red y la dirección del contexto.',
    notFound: 'Recurso no encontrado (el pod puede haberse eliminado o recreado).',
    noContext: 'El contexto no existe en el kubeconfig.',
    missing: 'kubectl no encontrado. Instálelo con: {hint}',
    plugin: 'Plugin de inicio de sesión `{name}` no encontrado. El kubeconfig de este contexto lo usa para entrar al clúster: instálelo o compruebe que su carpeta está en el PATH.',
    timeout: 'El clúster no respondió en {s} s ({cmd}). Revise la VPN/red y si la sesión del contexto sigue siendo válida (oc login, aws sso login…).',
  },
}

let current = 'pt-BR'

export function setMessagesLanguage(lang: string): void {
  current = lang in TEXTS ? lang : 'pt-BR'
}

export function messagesLanguage(): string {
  return current
}

export function texts(lang: string = current): Texts {
  return TEXTS[lang] ?? TEXTS['pt-BR']!
}
