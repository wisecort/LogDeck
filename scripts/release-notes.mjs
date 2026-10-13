#!/usr/bin/env node
// Prints the GitHub Release notes of a version: its CHANGELOG.md section plus the code signing policy link
// (SignPath Foundation requires the policy on the download page).
// Usage: node scripts/release-notes.mjs <version|vX.Y.Z> [owner/repo]
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/

export function releaseNotes(changelog, version, repo) {
  const v = version.replace(/^v/, '')
  if (!VERSION.test(v)) throw new Error(`versão inválida: ${version}`)
  const lines = changelog.split('\n')
  const start = lines.findIndex((l) => l.startsWith(`## [${v}]`))
  if (start === -1) throw new Error(`CHANGELOG sem a seção [${v}]`)
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((l) => l.startsWith('## '))
  const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim()
  if (!body) throw new Error(`seção [${v}] do CHANGELOG está vazia`)
  const url = `https://github.com/${repo}`
  return `${body}\n\n---\n\n[Code signing policy](${url}#code-signing-policy) · [Full changelog](${url}/blob/main/CHANGELOG.md)\n`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [version, repo = 'wisecort/LogDeck'] = process.argv.slice(2)
  if (!version) {
    console.error('uso: node scripts/release-notes.mjs <versão> [dono/repositório]')
    process.exit(2)
  }
  process.stdout.write(releaseNotes(readFileSync('CHANGELOG.md', 'utf8'), version, repo))
}
