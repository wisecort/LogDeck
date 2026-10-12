import { delimiter, resolve } from 'node:path'
import { defineConfig } from '@playwright/test'

// Safety net (AGENTS.md: never read ~/.kube): every app launched by E2E inherits the
// fake kubectl and the fake kubeconfig, even if a test forgets to pass its own env.
process.env['PATH'] = `${resolve(__dirname, 'tests/bin')}${delimiter}${process.env['PATH'] ?? ''}`
process.env['KUBECONFIG'] = resolve(__dirname, 'tests/fixtures/kubectl/kubeconfig.fake.yaml')

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  workers: 1,
  reporter: 'list',
})
