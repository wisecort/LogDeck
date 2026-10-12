// Windows only: turns the test fakes in tests/bin (Node scripts with "#!") into real .exe files with
// Node's single executable applications, because LogDeck spawns binaries without a shell (G2) and
// Windows cannot run "#!" scripts. The .exe files are gitignored and rebuilt by the harness.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

if (process.platform !== 'win32') {
  console.log('build-test-bins: nada a fazer fora do Windows')
  process.exit(0)
}

const bin = resolve(import.meta.dirname, '../tests/bin')
const work = mkdtempSync(join(tmpdir(), 'logdeck-sea-'))
for (const name of ['kubectl', 'claude', 'security']) {
  const config = join(work, `${name}.json`)
  writeFileSync(config, JSON.stringify({ main: join(bin, name), output: join(bin, `${name}.exe`), disableExperimentalSEAWarning: true, useCodeCache: false }))
  execFileSync(process.execPath, ['--build-sea', config], { stdio: 'inherit' })
  console.log(`✅ tests/bin/${name}.exe`)
}
