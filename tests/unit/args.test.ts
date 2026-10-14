import { describe, expect, it } from 'vitest'
import {
  assertReadOnly,
  assertShellArgs,
  buildCanIArgs,
  buildGetContextsArgs,
  buildGetEventsArgs,
  buildGetIngressesArgs,
  buildGetRoutesArgs,
  buildGetServicesArgs,
  buildGetNamespacesArgs,
  buildGetPodsArgs,
  buildLogsArgs,
  buildShellArgs,
  buildVersionArgs,
  UnsafeArgsError,
  validateContainerName,
  validateContextName,
  validateNamespace,
  validatePodName,
  type PodTarget,
} from '../../src/k8s/args'

const HML = 'portal-hml/api-hml-example-internal:6443/dev'
const KNOWN = [HML, 'portal-prd/api-prd-example-internal:6443/dev', 'kind-logdeck-test']
const T = { context: HML, knownContexts: KNOWN }
const POD: PodTarget = { ...T, namespace: 'portal-hml', pod: 'portal-web-7d9f8c6b5-x2k4p', container: 'httpd' }

const BAD_NAMES = ['a;b', '$(id)', '`id`', 'a b', '../etc', '-n', '--raw', 'A', '', 'a\nb', 'a|b', 'a&&b', "a'b", 'a/b']

describe('name validation (G2)', () => {
  it('accepts DNS-1123 labels for namespace and container', () => {
    expect(validateNamespace('portal-hml')).toBe('portal-hml')
    expect(validateContainerName('php-fpm')).toBe('php-fpm')
    expect(validateNamespace('a'.repeat(63))).toBe('a'.repeat(63))
  })

  it.each(BAD_NAMES)('rejects namespace %j', (name) => {
    expect(() => validateNamespace(name)).toThrow(UnsafeArgsError)
  })

  it.each(BAD_NAMES)('rejects container %j', (name) => {
    expect(() => validateContainerName(name)).toThrow(UnsafeArgsError)
  })

  it('rejects labels longer than 63 or ending with a dash', () => {
    expect(() => validateNamespace('a'.repeat(64))).toThrow(UnsafeArgsError)
    expect(() => validateNamespace('abc-')).toThrow(UnsafeArgsError)
    expect(() => validateNamespace('a.b')).toThrow(UnsafeArgsError)
  })

  it('accepts DNS-1123 subdomains for pods', () => {
    expect(validatePodName('portal-web-7d9f8c6b5-x2k4p')).toBe('portal-web-7d9f8c6b5-x2k4p')
    expect(validatePodName('etcd-node1.example')).toBe('etcd-node1.example')
  })

  it.each([...BAD_NAMES, 'a'.repeat(254), 'a..b', '.a'])('rejects pod %j', (name) => {
    expect(() => validatePodName(name)).toThrow(UnsafeArgsError)
  })

  it('accepts OKD context names that are in the known list', () => {
    expect(validateContextName(HML, KNOWN)).toBe(HML)
  })

  it('rejects contexts that are unknown, start with "-" or contain control characters', () => {
    expect(() => validateContextName('other', KNOWN)).toThrow(UnsafeArgsError)
    expect(() => validateContextName('-x', ['-x'])).toThrow(UnsafeArgsError)
    expect(() => validateContextName('a\nb', ['a\nb'])).toThrow(UnsafeArgsError)
    expect(() => validateContextName('', [''])).toThrow(UnsafeArgsError)
  })
})

describe('builders', () => {
  it('version --client does not need a context', () => {
    expect(buildVersionArgs()).toEqual(['version', '--client', '-o', 'json'])
  })

  it('lists contexts with get-contexts only (G3)', () => {
    expect(buildGetContextsArgs()).toEqual(['config', 'get-contexts'])
  })

  it('always passes --context explicitly (G4)', () => {
    expect(buildGetNamespacesArgs(T)).toEqual(['get', 'namespaces', '-o', 'json', `--context=${HML}`])
    expect(buildGetPodsArgs({ ...T, namespace: 'portal-hml' })).toEqual(['get', 'pods', '-n', 'portal-hml', '-o', 'json', `--context=${HML}`])
  })

  it('reads the events of a namespace (read-only get; filtered by pod in the app)', () => {
    expect(buildGetEventsArgs({ ...T, namespace: 'portal-hml' })).toEqual(['get', 'events', '-n', 'portal-hml', '-o', 'json', `--context=${HML}`])
    expect(() => buildGetEventsArgs({ ...T, namespace: '$(id)' })).toThrow(UnsafeArgsError)
  })

  it('reads services, OKD routes and ingresses of a namespace (pod access)', () => {
    const ns = { ...T, namespace: 'portal-hml' }
    expect(buildGetServicesArgs(ns)).toEqual(['get', 'services', '-n', 'portal-hml', '-o', 'json', `--context=${HML}`])
    expect(buildGetRoutesArgs(ns)).toEqual(['get', 'routes.route.openshift.io', '-n', 'portal-hml', '-o', 'json', `--context=${HML}`])
    expect(buildGetIngressesArgs(ns)).toEqual(['get', 'ingresses', '-n', 'portal-hml', '-o', 'json', `--context=${HML}`])
  })

  it('builds auth can-i', () => {
    expect(buildCanIArgs({ ...T, verb: 'list', resource: 'namespaces' })).toEqual(['auth', 'can-i', 'list', 'namespaces', `--context=${HML}`])
    expect(buildCanIArgs({ ...T, namespace: 'portal-hml', verb: 'get', resource: 'pods/log' })).toEqual([
      'auth',
      'can-i',
      'get',
      'pods/log',
      '-n',
      'portal-hml',
      `--context=${HML}`,
    ])
  })

  it('builds the live logs command (F3.1)', () => {
    expect(buildLogsArgs(POD, { follow: true, tail: 1000 })).toEqual([
      'logs',
      'portal-web-7d9f8c6b5-x2k4p',
      '-n',
      'portal-hml',
      '-c',
      'httpd',
      '--timestamps',
      '-f',
      '--tail=1000',
      `--context=${HML}`,
    ])
  })

  it('supports --since and --since-time', () => {
    expect(buildLogsArgs(POD, { since: '15m' })).toContain('--since=15m')
    expect(buildLogsArgs(POD, { sinceTime: '2026-10-09T03:26:40.123Z' })).toContain('--since-time=2026-10-09T03:26:40.123Z')
  })

  it('drops -f with --previous (F3.2)', () => {
    const argv = buildLogsArgs(POD, { follow: true, previous: true })
    expect(argv).toContain('--previous')
    expect(argv).not.toContain('-f')
  })

  it.each([
    [{ tail: -2 }],
    [{ tail: 100_001 }],
    [{ tail: 1.5 }],
    [{ since: '5 m' }],
    [{ since: '5d' }],
    [{ since: '5m;id' }],
    [{ sinceTime: 'yesterday' }],
    [{ sinceTime: '2026-10-09T03:26:40Z;id' }],
  ])('rejects bad logs option %j', (opts) => {
    expect(() => buildLogsArgs(POD, opts)).toThrow(UnsafeArgsError)
  })

  it('accepts tail -1 (all lines)', () => {
    expect(buildLogsArgs(POD, { tail: -1 })).toContain('--tail=-1')
  })

  it('validates names inside builders', () => {
    expect(() => buildLogsArgs({ ...POD, pod: 'x;rm' }, {})).toThrow(UnsafeArgsError)
    expect(() => buildGetPodsArgs({ ...T, namespace: '$(id)' })).toThrow(UnsafeArgsError)
    expect(() => buildGetNamespacesArgs({ ...T, context: 'unknown' })).toThrow(UnsafeArgsError)
  })

  it('builds the Pod Shell with a TTY (P5)', () => {
    expect(buildShellArgs(POD)).toEqual([
      'exec',
      '-it',
      'portal-web-7d9f8c6b5-x2k4p',
      '-n',
      'portal-hml',
      '-c',
      'httpd',
      `--context=${HML}`,
      '--',
      'sh',
      '-c',
      'command -v bash >/dev/null && exec bash || exec sh',
    ])
  })
})

describe('assertReadOnly — final gate before spawn (G1)', () => {
  it('accepts every builder output except the shell', () => {
    for (const argv of [
      buildVersionArgs(),
      buildGetContextsArgs(),
      buildGetNamespacesArgs(T),
      buildGetPodsArgs({ ...T, namespace: 'portal-hml' }),
      buildGetEventsArgs({ ...T, namespace: 'portal-hml' }),
      buildGetServicesArgs({ ...T, namespace: 'portal-hml' }),
      buildGetRoutesArgs({ ...T, namespace: 'portal-hml' }),
      buildGetIngressesArgs({ ...T, namespace: 'portal-hml' }),
      buildCanIArgs({ ...T, verb: 'list', resource: 'pods' }),
      buildLogsArgs(POD, { follow: true, tail: 10, since: '1h' }),
      buildLogsArgs(POD, { previous: true }),
    ]) {
      expect(() => assertReadOnly(argv)).not.toThrow()
    }
  })

  it.each([
    [['delete', 'pod', 'x', `--context=${HML}`]],
    [['apply', '-f', 'x.yaml', `--context=${HML}`]],
    [['patch', 'deploy', 'x', `--context=${HML}`]],
    [['scale', 'deploy/x', '--replicas=0', `--context=${HML}`]],
    [['rollout', 'restart', 'deploy/x', `--context=${HML}`]],
    [['edit', 'cm', 'x', `--context=${HML}`]],
    [['cordon', 'node1', `--context=${HML}`]],
    [['drain', 'node1', `--context=${HML}`]],
    [['config', 'use-context', 'kind-logdeck-test']],
    [['config', 'view', '--raw']],
    [['config', 'view', '--minify', '--raw']],
    [['config', 'view', '--flatten']],
    [['get', 'secrets', '-n', 'portal-hml', '-o', 'json', `--context=${HML}`]],
    [['get', 'configmaps', '-n', 'portal-hml', '-o', 'json', `--context=${HML}`]],
    [['get', 'endpoints', '-n', 'portal-hml', '-o', 'json', `--context=${HML}`]],
    [['get', 'pods', '-n', 'portal-hml', '-o', 'json']],
    [['get', 'pods', '-n', 'portal-hml', '-o', 'json', `--context=${HML}`, '--kubeconfig=/tmp/x']],
    [['logs', 'p', '-n', 'ns', `--context=${HML}`, '--token=abc']],
    [['version']],
    [['exec', '-it', 'p', '-n', 'ns', `--context=${HML}`, '--', 'sh']],
    [[]],
  ])('rejects %j', (argv) => {
    expect(() => assertReadOnly(argv)).toThrow(UnsafeArgsError)
  })
})

describe('assertReadOnly — allowlisted shapes not produced by builders', () => {
  it.each([
    [['version', '--client']],
    [['config', 'get-contexts', '-o', 'name']],
    [['config', 'get-contexts', '--no-headers']],
    [['config', 'view', '--minify', '-o', 'jsonpath={..namespace}', `--context=${HML}`]],
    [['get', 'pods', '-n', 'portal-hml', '-o', 'json', `--context=${HML}`, '--request-timeout=10s']],
    [['auth', 'can-i', 'watch', 'pods', '-n', 'portal-hml', `--context=${HML}`]],
  ])('accepts %j', (argv) => {
    expect(() => assertReadOnly(argv)).not.toThrow()
  })

  it.each([
    [['version', '-o', 'json']],
    [['config', 'view', '-o', 'json']],
    [['config', 'get-contexts', '-o', 'yaml']],
    [['config', 'set', 'contexts.x.namespace', 'y']],
    [['auth', 'can-i', 'delete', 'pods', `--context=${HML}`]],
    [['auth', 'can-i', 'get', 'secrets', `--context=${HML}`]],
    [['auth', 'whoami', `--context=${HML}`]],
    [['logs']],
    [['logs', 'p', '-n', 'ns', `--context=${HML}`, '--context=kind-logdeck-test']],
    [['logs', 'p', '-n', 'ns', '--tail=-5', `--context=${HML}`]],
    [['logs', 'p', '-n', 'ns', '--since=1d', `--context=${HML}`]],
    [['logs', 'p', '-n', 'ns', '--since-time=yesterday', `--context=${HML}`]],
    [['get', 'pods', '-n']],
    [['get', 'pods', '-n', 'portal-hml', '--context=-x']],
    [['get', 'pods', '-n', 'portal-hml', `--context=${HML}`, '--request-timeout=forever']],
    [['get', 'pods', '-n', 'portal-hml', '-o', 'yaml', `--context=${HML}`]],
    [['get', 'events', '-n', 'portal-hml', '-o', 'json', '--watch', `--context=${HML}`]],
    [['get', 'events', '-n', 'portal-hml', '--field-selector=involvedObject.name=x', `--context=${HML}`]],
  ])('rejects %j', (argv) => {
    expect(() => assertReadOnly(argv)).toThrow(UnsafeArgsError)
  })
})

describe('assertShellArgs', () => {
  it('accepts the shell builder output only', () => {
    expect(() => assertShellArgs(buildShellArgs(POD))).not.toThrow()
    expect(() => assertShellArgs(['exec', '-it', 'p', '-n', 'ns', `--context=${HML}`, '--', 'rm', '-rf', '/'])).toThrow(UnsafeArgsError)
    expect(() => assertShellArgs(buildLogsArgs(POD, {}))).toThrow(UnsafeArgsError)
  })
})
