// F7 end to end with the fake Claude Code CLI: preferences → select group → masked preview with
// destination → explicit send → answer with write-command warning and reviewable diff.
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { fakeKubectlEnv } from '../helpers/fake-kubectl'

const HML = 'portal-hml/api-hml-example-internal:6443/dev'

let app: ElectronApplication
let win: Page
let claudeLog: string

test.beforeEach(async () => {
  const fake = fakeKubectlEnv({ FAKE_KUBECTL_DELAY_MS: '0' })
  claudeLog = join(mkdtempSync(join(tmpdir(), 'logdeck-e2e-claude-')), 'calls.jsonl')
  app = await electron.launch({
    args: ['.'],
    env: {
      ...(fake.env as Record<string, string>),
      LOGDECK_USER_DATA: mkdtempSync(join(tmpdir(), 'logdeck-e2e-')),
      FAKE_CLAUDE_LOG: claudeLog,
    },
  })
  win = await app.firstWindow()
})

test.afterEach(async () => {
  await app.close()
})

const claudeCalls = () =>
  existsSync(claudeLog)
    ? readFileSync(claudeLog, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as { argv: string[]; stdin: string })
    : []

async function openWebPod() {
  await win.getByLabel('Contexto').selectOption(HML)
  await win.getByLabel('Namespace').selectOption('portal-hml')
  await win.getByRole('button', { name: /portal-web/ }).click()
  await win.getByRole('group', { name: 'Containers' }).getByRole('button', { name: 'httpd', exact: true }).click()
  await expect(win.getByTestId('match-count')).toContainText('/ 465')
}

test('the explain button needs a selected group and a configured provider', async () => {
  await openWebPod()
  const button = win.getByRole('button', { name: /Explicar esses erros/ })
  await expect(button).toBeDisabled()
  await win.getByLabel('Selecionar Timeout Apache → PHP-FPM').check()
  await button.click()
  await expect(win.getByTestId('ai-error')).toContainText('Configure um provedor')
  expect(claudeCalls()).toEqual([])
})

test('F7: preview with destination, nothing sent until "Enviar", then the answer', async () => {
  await openWebPod()

  // Preferences: pick the Claude Code CLI (the fake one) and test it with a fixed prompt.
  await win.getByRole('button', { name: '⚙ IA' }).click()
  await win.getByRole('radio', { name: /Claude Code CLI/ }).check()
  await expect(win.getByTestId('claude-status')).toContainText('2.1.296 (Claude Code)')
  await win.getByRole('button', { name: 'Testar provedor' }).click()
  await expect(win.getByTestId('ai-test-result')).toContainText('Provedor respondeu')
  expect(claudeCalls().at(-1)!.stdin).toBe('Responda apenas OK')
  await win.getByRole('button', { name: 'Salvar', exact: true }).click()

  // Select the P4 timeout group and open the preview.
  await win.getByLabel('Selecionar Timeout Apache → PHP-FPM').check()
  const callsBefore = claudeCalls().length
  await win.getByRole('button', { name: /Explicar esses erros \(1\)/ }).click()
  await expect(win.getByTestId('ai-destination')).toContainText('Claude Code CLI · sua conta Anthropic')
  await expect(win.getByTestId('ai-preview')).toContainText('Timeout Apache → PHP-FPM (6 ocorrências)')
  await expect(win.getByTestId('ai-preview')).toContainText('10.0.0.2')
  await win.getByLabel('Mascarar IPs internos').check()
  await expect(win.getByTestId('ai-preview')).toContainText('[REDACTED:IP]')
  await expect(win.getByTestId('ai-preview')).not.toContainText('10.0.0.2')
  await win.screenshot({ path: 'test-results/ai-preview.png' })
  expect(claudeCalls().length).toBe(callsBefore) // G6: preview sends nothing

  await win.getByRole('button', { name: 'Enviar' }).click()
  await expect(win.getByTestId('ai-result')).toContainText('Causa provável')
  await expect(win.getByTestId('ai-write-warning')).toContainText('kubectl delete pod portal-web-x')
  await expect(win.getByTestId('ai-diff')).toContainText('+ pm.max_children = 20')
  await expect(win.getByRole('button', { name: 'Salvar em arquivo…' })).toBeVisible()
  await win.screenshot({ path: 'test-results/ai-result.png' })

  const sent = claudeCalls().at(-1)!
  expect(sent.stdin).toContain('<logs>')
  expect(sent.stdin).toContain('AH01075')
  expect(sent.stdin).not.toContain('10.0.0.2')
  expect(sent.argv[sent.argv.indexOf('--tools') + 1]).toBe('')
})
