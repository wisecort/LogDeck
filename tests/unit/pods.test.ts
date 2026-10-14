import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { formatAge, parseNamespaces, parsePods } from '../../src/k8s/pods'
import { FIXTURES } from '../helpers/fake-kubectl'

const NS = readFileSync(join(FIXTURES, 'kubectl/namespaces.json'), 'utf8')
const PODS = readFileSync(join(FIXTURES, 'kubectl/pods.json'), 'utf8')

type PodJson = Record<string, unknown>
const list = (...items: PodJson[]) => JSON.stringify({ items })
const pod = (name: string, status: PodJson, spec: PodJson = { containers: [{ name: 'app' }] }, meta: PodJson = {}) => ({
  metadata: { name, namespace: 'portal-hml', ...meta },
  spec,
  status,
})

describe('parseNamespaces', () => {
  it('returns sorted names', () => {
    expect(parseNamespaces(NS)).toEqual(['default', 'monitoring', 'portal-hml'])
  })

  it('throws on malformed JSON', () => {
    expect(() => parseNamespaces('{oops')).toThrow()
  })
})

describe('OKD build and deployer pods', () => {
  const pods = parsePods(PODS)
  const kind = (name: string) => pods.find((p) => p.name === name)?.kind

  it('marks pods created by a BuildConfig as build (openshift.io/build.name)', () => {
    expect(kind('portal-web-12-build')).toBe('build')
  })

  it('marks DeploymentConfig deployer pods as deploy (openshift.io/deployer-pod-for.name)', () => {
    expect(kind('portal-web-3-deploy')).toBe('deploy')
  })

  it('everything else is an app pod, including Jobs', () => {
    expect(kind('portal-web-7d9f8c6b5-x2k4p')).toBe('app')
    expect(kind('portal-migrate-29341-7xk2m')).toBe('app')
  })

  it('relies on labels/annotations, not on the name', () => {
    const [p] = parsePods(JSON.stringify({ items: [{ metadata: { name: 'my-build', namespace: 'n' }, spec: { containers: [{ name: 'c' }] }, status: { phase: 'Running' } }] }))
    expect(p!.kind).toBe('app')
  })
})

describe('parsePods (F2.2, F2.3)', () => {
  const pods = parsePods(PODS)
  const byName = (prefix: string) => pods.find((p) => p.name.startsWith(prefix))!

  it('summarises a healthy multi-container pod', () => {
    const { details, ...summary } = byName('portal-web')!
    expect(details?.map((d) => d.name)).toEqual(['fix-permissions', 'httpd', 'php-fpm'])
    expect(summary).toEqual({
      name: 'portal-web-7d9f8c6b5-x2k4p',
      namespace: 'portal-hml',
      phase: 'Running',
      status: 'Running',
      ready: '2/2',
      restarts: 1,
      createdAt: Date.parse('2026-10-09T03:24:00Z'),
      containers: ['httpd', 'php-fpm'],
      initContainers: ['fix-permissions'],
      canPrevious: true,
      kind: 'app',
      node: 'node-a.example.internal',
      qosClass: 'Burstable',
      labels: { app: 'portal-web', 'pod-template-hash': '7d9f8c6b5' },
    })
  })

  it('shows CrashLoopBackOff with restarts and offers --previous', () => {
    expect(byName('portal-worker')).toMatchObject({ status: 'CrashLoopBackOff', ready: '0/1', restarts: 14, canPrevious: true })
  })

  it('shows Completed for finished jobs', () => {
    expect(byName('portal-migrate')).toMatchObject({ phase: 'Succeeded', status: 'Completed', canPrevious: false })
  })

  it('shows the waiting reason for pending pods', () => {
    expect(byName('portal-cron')).toMatchObject({ phase: 'Pending', status: 'ImagePullBackOff' })
  })

  it('prefixes init container problems with Init:', () => {
    const [p] = parsePods(
      list(
        pod(
          'p1',
          {
            phase: 'Pending',
            initContainerStatuses: [{ name: 'init', restartCount: 3, state: { waiting: { reason: 'CrashLoopBackOff' } } }],
            containerStatuses: [{ name: 'app', ready: false, restartCount: 0, state: { waiting: { reason: 'PodInitializing' } } }],
          },
          { initContainers: [{ name: 'init' }], containers: [{ name: 'app' }] },
        ),
      ),
    )
    expect(p).toMatchObject({ status: 'Init:CrashLoopBackOff', restarts: 3 })
  })

  it('shows Terminating and terminated reasons', () => {
    const [t, e] = parsePods(
      list(
        pod('p1', { phase: 'Running' }, undefined, { deletionTimestamp: '2026-10-09T03:30:00Z' }),
        pod('p2', { phase: 'Failed', containerStatuses: [{ name: 'app', ready: false, restartCount: 0, state: { terminated: { reason: 'Error' } } }] }),
      ),
    )
    expect(t!.status).toBe('Terminating')
    expect(e!.status).toBe('Error')
  })

  it('drops pods with invalid names and reports them (F2.4)', () => {
    const onInvalid = vi.fn()
    const pods = parsePods(list(pod('ok-pod', { phase: 'Running' }), pod('bad;name', { phase: 'Running' })), onInvalid)
    expect(pods.map((p) => p.name)).toEqual(['ok-pod'])
    expect(onInvalid).toHaveBeenCalledWith('bad;name')
  })

  it('drops invalid container names', () => {
    const [p] = parsePods(list(pod('p1', { phase: 'Running' }, { containers: [{ name: 'app' }, { name: '$(id)' }] })))
    expect(p!.containers).toEqual(['app'])
  })

  it('tolerates pods without status details', () => {
    const [p] = parsePods(list({ metadata: { name: 'bare', namespace: 'ns' } }))
    expect(p).toMatchObject({ name: 'bare', phase: 'Unknown', status: 'Unknown', ready: '0/0', restarts: 0, containers: [] })
  })
})

describe('formatAge', () => {
  it.each([
    [45_000, '45s'],
    [5 * 60_000, '5m'],
    [3 * 3600_000, '3h'],
    [2 * 86_400_000, '2d'],
    [-1, '0s'],
  ])('%i ms → %s', (ms, expected) => {
    expect(formatAge(ms)).toBe(expected)
  })
})

describe('container details (Pod tab, uptime, restart marks)', () => {
  const detailed = pod(
    'portal-worker-5c8d9',
    {
      phase: 'Running',
      qosClass: 'Burstable',
      containerStatuses: [
        {
          name: 'worker',
          ready: true,
          restartCount: 4,
          image: 'registry.example.internal/portal-worker:2.14.1',
          state: { running: { startedAt: '2026-10-09T14:04:57Z' } },
          lastState: { terminated: { reason: 'OOMKilled', exitCode: 137, startedAt: '2026-10-09T13:58:27Z', finishedAt: '2026-10-09T14:04:32Z' } },
        },
      ],
      initContainerStatuses: [{ name: 'fix-permissions', restartCount: 0, state: { terminated: { reason: 'Completed', exitCode: 0, finishedAt: '2026-10-04T09:12:10Z' } } }],
    },
    {
      nodeName: 'ip-10-0-0-21',
      initContainers: [{ name: 'fix-permissions', image: 'busybox:1.36' }],
      containers: [
        {
          name: 'worker',
          image: 'registry.example.internal/portal-worker:2.14.1',
          resources: { requests: { cpu: '100m', memory: '128Mi' }, limits: { cpu: '500m', memory: '256Mi' } },
          readinessProbe: { httpGet: { path: '/health', port: 8080 }, periodSeconds: 10 },
          livenessProbe: { tcpSocket: { port: 8080 } },
          startupProbe: { exec: { command: ['sh', '-c', 'cat /tmp/secret-token'] }, periodSeconds: 5 },
        },
      ],
    },
  )
  const [p] = parsePods(list(detailed))
  const worker = p!.details!.find((c) => c.name === 'worker')!

  it('reads node and QoS class', () => {
    expect(p!.node).toBe('ip-10-0-0-21')
    expect(p!.qosClass).toBe('Burstable')
  })

  it('reads the running state with its start time (uptime)', () => {
    expect(worker).toMatchObject({ init: false, state: 'running', restarts: 4, startedAt: Date.parse('2026-10-09T14:04:57Z') })
  })

  it('reads the previous run: reason, exit code and when it started and ended', () => {
    expect(worker.last).toEqual({
      reason: 'OOMKilled',
      exitCode: 137,
      startedAt: Date.parse('2026-10-09T13:58:27Z'),
      finishedAt: Date.parse('2026-10-09T14:04:32Z'),
    })
  })

  it('reads image, requests and limits', () => {
    expect(worker.image).toBe('registry.example.internal/portal-worker:2.14.1')
    expect(worker.requests).toEqual({ cpu: '100m', memory: '128Mi' })
    expect(worker.limits).toEqual({ cpu: '500m', memory: '256Mi' })
  })

  it('summarizes probes without exposing exec commands', () => {
    expect(worker.probes).toEqual({
      readiness: { kind: 'http', target: 'GET :8080/health', periodSeconds: 10 },
      liveness: { kind: 'tcp', target: ':8080' },
      startup: { kind: 'command', periodSeconds: 5 },
    })
    expect(JSON.stringify(p)).not.toContain('secret-token')
  })

  it('lists init containers too, flagged as init', () => {
    expect(p!.details!.find((c) => c.name === 'fix-permissions')).toMatchObject({ init: true, state: 'terminated', reason: 'Completed', image: 'busybox:1.36' })
  })

  it('reports waiting containers with their reason', () => {
    const [w] = parsePods(list(pod('w', { phase: 'Running', containerStatuses: [{ name: 'app', restartCount: 7, state: { waiting: { reason: 'CrashLoopBackOff' } } }] })))
    expect(w!.details![0]).toMatchObject({ state: 'waiting', reason: 'CrashLoopBackOff', restarts: 7 })
  })

  it('skips containers with invalid names and ignores bad timestamps', () => {
    const [w] = parsePods(
      list(pod('w', { phase: 'Running', containerStatuses: [{ name: 'Bad_Name' }, { name: 'app', state: { running: { startedAt: 'yesterday' } } }] }, { containers: [{ name: 'Bad_Name' }, { name: 'app' }] })),
    )
    expect(w!.details!.map((c) => c.name)).toEqual(['app'])
    expect(w!.details![0]!.startedAt).toBeUndefined()
  })
})

describe('pod labels (matched against service selectors)', () => {
  it('keeps the labels as strings', () => {
    const [p] = parsePods(list(pod('w', { phase: 'Running' }, { containers: [{ name: 'app' }] }, { labels: { app: 'portal-web', bad: 3 } })))
    expect(p!.labels).toEqual({ app: 'portal-web' })
  })
})
