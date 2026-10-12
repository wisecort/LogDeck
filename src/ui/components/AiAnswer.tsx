import { useState } from 'react'
import type { ExplainResult, ResponseBlock } from '../../shared/ai'
import { useI18n } from '../i18n'
import { IconCopy } from './icons'

function TextBlock({ content }: { content: string }) {
  // Plain text only (G7): headings are styled, nothing is parsed as HTML.
  return (
    <div className="ai-text">
      {content.split('\n').map((line, i) => (line.startsWith('#') ? <h4 key={i}>{line.replace(/^#+\s*/, '')}</h4> : <p key={i}>{line}</p>))}
    </div>
  )
}

function CodeBlock({ block, dangerous }: { block: ResponseBlock; dangerous: readonly string[] }) {
  const { t } = useI18n()
  const lines = block.content.split('\n')
  const isDanger = (l: string) => dangerous.some((d) => l.includes(d) || d.includes(l.trim()))
  const risky = lines.some((l) => l.trim() && isDanger(l))
  return (
    <div className="ai-code">
      <pre className="code-box">
        {lines.map((l, i) => (
          <span key={i} className={l.trim() && isDanger(l) ? 'write-cmd' : undefined}>
            {l}
            {'\n'}
          </span>
        ))}
      </pre>
      {!risky && (
        <button className="icon-btn" onClick={() => void window.logdeck.copyText(block.content)} title={t('ai.copyRead')}>
          <IconCopy /> {t('common.copy')}
        </button>
      )}
    </div>
  )
}

function DiffBlock({ block }: { block: ResponseBlock }) {
  const { t } = useI18n()
  const [saved, setSaved] = useState<string>()
  const ext = block.lang === 'yaml' || block.lang === 'yml' ? 'yaml' : 'diff'
  return (
    <div className="ai-diff" data-testid="ai-diff">
      <div className="muted">{t('ai.diffNote')}</div>
      <pre className="code-box">
        {block.content.split('\n').map((l, i) => (
          <span key={i} className={l.startsWith('+') ? 'add' : l.startsWith('-') ? 'del' : undefined} style={{ display: 'block' }}>
            <span className="ln">{i + 1}</span>
            {l}
          </span>
        ))}
      </pre>
      <span>
        <button className="icon-btn" onClick={() => void window.logdeck.copyText(block.content)}>
          <IconCopy /> {t('ai.copyDiff')}
        </button>
        <button onClick={() => void window.logdeck.saveText(block.content, `logdeck-sugestao.${ext}`).then((p) => p && setSaved(p))}>
          {t('ai.saveFile')}
        </button>
      </span>
      {saved && <span className="muted">{t('ai.savedAt', { path: saved })}</span>}
    </div>
  )
}

export function AiAnswer({ result }: { result: ExplainResult }) {
  const { t } = useI18n()
  return (
    <div className="ai-result" data-testid="ai-result">
      {result.writeCommands.length > 0 && (
        <div className="warn-box" data-testid="ai-write-warning">
          ⚠ {t('ai.writeWarning')}
          <ul>
            {result.writeCommands.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.blocks.map((b, i) =>
        b.type === 'text' ? <TextBlock key={i} content={b.content} /> : b.type === 'diff' ? <DiffBlock key={i} block={b} /> : <CodeBlock key={i} block={b} dangerous={result.writeCommands} />,
      )}
      {result.confidence !== undefined && (
        <div className="confidence" title={t('ai.confidenceHint')}>
          <span>{t('ai.confidence')}</span>
          <div className="confidence-bar">
            <span style={{ width: `${result.confidence}%` }} />
          </div>
          <strong>{result.confidence}%</strong>
        </div>
      )}
    </div>
  )
}
