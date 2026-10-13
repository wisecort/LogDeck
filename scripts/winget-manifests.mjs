#!/usr/bin/env node
// Writes the winget manifests of a new LogDeck version from the latest folder in packaging/winget.
// Usage: node scripts/winget-manifests.mjs <version> <sha256> [outDir]
// Only version references, the installer hash and the release date change; everything else is copied.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/
const ROOT = 'packaging/winget/manifests/w/wisecort/LogDeck'

export function latestTemplateVersion(names) {
  const key = (v) => v.split('.').map(Number)
  return names
    .filter((n) => VERSION.test(n))
    .sort((a, b) => {
      const [x, y] = [key(a), key(b)]
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
    })
    .at(-1)
}

export function bumpManifests(files, { from, to, sha256, date }) {
  if (!VERSION.test(from) || !VERSION.test(to)) throw new Error(`versão inválida: ${from} → ${to}`)
  if (!/^[0-9a-f]{64}$/i.test(sha256)) throw new Error('SHA-256 inválido')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('data inválida (AAAA-MM-DD)')
  const out = {}
  for (const [name, text] of Object.entries(files)) {
    out[name] = text
      .split(from)
      .join(to)
      .replace(/^(\s*InstallerSha256:\s*)[0-9A-Fa-f]{64}\s*$/m, `$1${sha256.toUpperCase()}`)
      .replace(/^(ReleaseDate:\s*)\S+\s*$/m, `$1${date}`)
  }
  return out
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [to, sha256, outDir = ROOT] = process.argv.slice(2)
  if (!to || !sha256) {
    console.error('uso: node scripts/winget-manifests.mjs <versão> <sha256> [pasta]')
    process.exit(2)
  }
  const from = latestTemplateVersion(readdirSync(ROOT))
  if (!from) throw new Error(`nenhum manifesto em ${ROOT}`)
  const files = Object.fromEntries(readdirSync(join(ROOT, from)).map((n) => [n, readFileSync(join(ROOT, from, n), 'utf8')]))
  const date = new Date().toISOString().slice(0, 10)
  const target = join(outDir, to)
  mkdirSync(target, { recursive: true })
  for (const [name, text] of Object.entries(bumpManifests(files, { from, to, sha256, date }))) writeFileSync(join(target, name), text)
  console.log(`✅ manifestos ${from} → ${to} em ${target}`)
}
