#!/usr/bin/env node
// Builds the GitHub Pages site (site/) into an output folder: one page per language, the README screenshots
// and the demo video. Download links point at the installers of the given release.
// Usage: node scripts/build-site.mjs <version|vX.Y.Z> <owner/repo> <out-dir>
import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { strings } from '../site/i18n.mjs'

const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/

/** Languages and where their page lives (en at the root). */
export const LANGS = ['en', 'pt-BR']
const DIR = { en: '', 'pt-BR': 'pt-BR/' }
/** README screenshots per language. */
const IMAGES = { en: 'docs/images/en', 'pt-BR': 'docs/images' }

export function downloads(version, repo) {
  const v = version.replace(/^v/, '')
  if (!VERSION.test(v)) throw new Error(`versão inválida: ${version}`)
  const base = `https://github.com/${repo}/releases/download/v${v}/LogDeck-${v}`
  return {
    macArm: `${base}-arm64.dmg`,
    macIntel: `${base}-x64.dmg`,
    win: `${base}-x64.exe`,
    deb: `${base}-amd64.deb`,
    rpm: `${base}-x86_64.rpm`,
    appImage: `${base}-x86_64.AppImage`,
  }
}

/**
 * Fills `{{t.key}}` (translated string), `{{dl.key}}` (download URL) and `{{version}}`, `{{lang}}`,
 * `{{root}}` (path back to the site root) and `{{img}}` (this language's screenshots). Throws on an unknown key.
 */
export function renderPage(template, lang, version, repo) {
  const t = strings[lang]
  if (!t) throw new Error(`idioma sem textos: ${lang}`)
  const root = DIR[lang] ? '../' : './'
  const values = {
    version: version.replace(/^v/, ''),
    lang,
    root,
    img: `${root}img/${lang}`,
    repo,
  }
  const dl = downloads(version, repo)
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const [ns, name] = key.split('.')
    const value = ns === 't' ? t[name] : ns === 'dl' ? dl[name] : values[key]
    if (value === undefined) throw new Error(`placeholder sem valor: ${key}`)
    // Translated strings may carry {{version}} or {{repo}} themselves.
    return ns === 't' ? value.replace(/\{\{(\w+)\}\}/g, (m, k) => values[k] ?? m) : value
  })
}

function build(version, repo, out) {
  const template = readFileSync('site/index.html', 'utf8')
  for (const lang of LANGS) {
    mkdirSync(join(out, DIR[lang]), { recursive: true })
    writeFileSync(join(out, DIR[lang], 'index.html'), renderPage(template, lang, version, repo))
    mkdirSync(join(out, 'img', lang), { recursive: true })
    for (const f of readdirSync(IMAGES[lang]).filter((n) => n.endsWith('.png'))) {
      cpSync(join(IMAGES[lang], f), join(out, 'img', lang, f))
    }
  }
  for (const f of ['styles.css', 'app.js', 'media']) cpSync(join('site', f), join(out, f), { recursive: true })
  cpSync('build/icon.png', join(out, 'icon.png'))
  writeFileSync(join(out, '.nojekyll'), '')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [version, repo, out] = process.argv.slice(2)
  if (!version || !repo || !out) {
    console.error('uso: node scripts/build-site.mjs <versão> <owner/repo> <pasta-de-saída>')
    process.exit(1)
  }
  build(version, repo, out)
  console.log(`site ${version} gerado em ${out}`)
}
