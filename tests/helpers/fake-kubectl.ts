import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { withPathFirst } from './path'

export const FAKE_BIN = resolve(__dirname, '../bin')
export const FIXTURES = resolve(__dirname, '../fixtures')

export interface FakeKubectlEnv {
  env: NodeJS.ProcessEnv
  /** argv of every kubectl invocation, in order */
  calls(): string[][]
}

/** Environment with tests/bin first in PATH and an argv log, for spawning the fake kubectl. */
export function fakeKubectlEnv(extra: Record<string, string> = {}): FakeKubectlEnv {
  const dir = mkdtempSync(join(tmpdir(), 'logdeck-fake-kubectl-'))
  const log = join(dir, 'argv.jsonl')
  const env = {
    ...withPathFirst(process.env, FAKE_BIN),
    FAKE_KUBECTL_ARGV_LOG: log,
    KUBECONFIG: join(FIXTURES, 'kubectl/kubeconfig.fake.yaml'),
    ...extra,
  }
  return {
    env,
    calls: () =>
      existsSync(log)
        ? readFileSync(log, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map((l) => JSON.parse(l) as string[])
        : [],
  }
}
