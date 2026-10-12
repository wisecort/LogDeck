// F7 end to end with the fake Claude Code CLI, now in the AI tab with questions and follow-ups.
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { fakeKubectlEnv } from '../helpers/fake-kubectl'
import { openWebPod } from '../helpers/ui'

let app: ElectronApplication
let win: Page
let claudeLog: string

test.beforeEach(async () => {
  const fake = fakeKubectlEnv({ FAKE_KUBECTL_DELAY_MS: '0' })
  claudeLog = join(mkdtempSync(join(tmpdir(), 'logdeck-e2e-claude-')), 'calls.jsonl')
  app = await electron.launch({
    args: ['.', '--lang=pt-BR'],
    env: { ...(fake.env as Record<string, string>), LOGDECK_USER_DATA: mkdtempSync(join(tmpdir(), 'logdeck-e2e-')), FAKE_CLAUDE_LOG: claudeLog },
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

async function useClaude() {
  await win.getByRole('button', { name: 'Preferências de IA' }).click()
  await win.getByRole('radio', { name: /Claude Code CLI/ }).check()
  await expect(win.getByTestId('claude-status')).toContainText('2.1.296 (Claude Code)')
  await win.getByRole('button', { name: 'Testar provedor' }).click()
  await expect(win.getByTestId('ai-test-result')).toContainText('Provedor respondeu')
  expect(claudeCalls().at(-1)!.stdin).toBe('Responda apenas OK')
  await win.getByRole('button', { name: 'Salvar', exact: true }).click()
}

test('without a provider the AI tab asks to configure one and sends nothing', async () => {
  await openWebPod(win)
  const explain = win.getByRole('button', { name: /Explicar esses erros/ })
  await expect(explain).toBeDisabled()
  await win.getByLabel('Selecionar Timeout Apache → PHP-FPM').check()
  await explain.click()
  await expect(win.getByText('Nenhum provedor configurado')).toBeVisible()
  expect(claudeCalls()).toEqual([])
})

test('F7: question + masked preview with destination, explicit send, answer and follow-up', async () => {
  await openWebPod(win)
  await useClaude()

  await win.getByLabel('Selecionar Timeout Apache → PHP-FPM').check()
  await win.getByRole('button', { name: /Explicar esses erros \(1\)/ }).click()
  await win.getByLabel('Pergunta para a IA').fill('por que acontece a cada 30 segundos?')
  const before = claudeCalls().length
  await win.getByRole('button', { name: 'Preparar envio' }).click()
  await expect(win.getByTestId('ai-destination')).toContainText('Claude Code CLI · sua conta Anthropic')
  await expect(win.getByTestId('ai-preview')).toContainText('Timeout Apache → PHP-FPM (6 ocorrências)')
  await expect(win.getByTestId('ai-preview')).toContainText('10.0.0.2')
  await win.getByLabel('Mascarar IPs internos').check()
  await expect(win.getByTestId('ai-preview')).toContainText('[REDACTED:IP]')
  expect(claudeCalls().length).toBe(before) // G6: preview sends nothing
  await win.screenshot({ path: 'test-results/ai-preview.png' })

  await win.getByRole('button', { name: 'Enviar', exact: true }).click()
  await expect(win.getByTestId('ai-result')).toContainText('Causa provável')
  await expect(win.getByTestId('ai-write-warning')).toContainText('kubectl delete pod portal-web-x')
  await expect(win.getByTestId('ai-diff')).toContainText('+ pm.max_children = 20')
  const first = claudeCalls().at(-1)!
  expect(first.stdin).toContain('Pergunta do usuário: por que acontece a cada 30 segundos?')
  expect(first.stdin).not.toContain('10.0.0.2')
  expect(first.argv[first.argv.indexOf('--tools') + 1]).toBe('')

  await win.getByLabel('Perguntar mais').fill('como confirmo o pm.max_children?')
  await win.getByLabel('Perguntar mais').press('Enter')
  await expect(win.getByTestId('ai-result')).toHaveCount(2)
  expect(claudeCalls().at(-1)!.stdin).toContain('Nova pergunta do usuário: como confirmo o pm.max_children?')
  await win.screenshot({ path: 'test-results/ai-result.png' })
})

test('asks about the selected line with the lines around it', async () => {
  await openWebPod(win)
  await useClaude()
  await win.getByLabel('Buscar').fill('AH01075')
  await win.getByTestId('log-row').first().click()
  await win.getByRole('button', { name: /Perguntar à IA/ }).click()
  await expect(win.getByRole('radio', { name: /Linha selecionada/ })).toBeChecked()
  await win.getByRole('button', { name: 'Preparar envio' }).click()
  await expect(win.getByTestId('ai-preview')).toContainText('>>> ')
  await expect(win.getByTestId('ai-preview')).toContainText('Linha selecionada (ERROR)')
})
