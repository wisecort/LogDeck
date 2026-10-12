import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { defineConfig } from '@playwright/test'

// Safety net (AGENTS.md: never read ~/.kube): every app launched by E2E inherits the
// fake kubectl and the fake kubeconfig, even if a test forgets to pass its own env.
process.env['PATH'] = `${resolve(__dirname, 'tests/bin')}${delimiter}${process.env['PATH'] ?? ''}`
process.env['KUBECONFIG'] = resolve(__dirname, 'tests/fixtures/kubectl/kubeconfig.fake.yaml')
// Same for AI: fake `claude` comes from tests/bin, and the Keychain is a fake `security`.
// On Windows the fakes are .exe files built by scripts/build-test-bins.mjs.
process.env['LOGDECK_SECURITY_BIN'] = resolve(__dirname, process.platform === 'win32' ? 'tests/bin/security.exe' : 'tests/bin/security')
process.env['FAKE_SECURITY_STORE'] = join(mkdtempSync(join(tmpdir(), 'logdeck-e2e-keychain-')), 'store.json')

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  workers: 1,
  reporter: 'list',
})
