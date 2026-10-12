#!/usr/bin/env node
// node-pty 1.1.0 ships its macOS spawn-helper without the executable bit, which makes
// every pty.spawn fail with "posix_spawnp failed". Runs as the project's postinstall.
import { chmodSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(import.meta.url), '../..')
for (const arch of ['darwin-arm64', 'darwin-x64']) {
  const helper = join(root, 'node_modules/node-pty/prebuilds', arch, 'spawn-helper')
  if (existsSync(helper)) chmodSync(helper, 0o755)
}
