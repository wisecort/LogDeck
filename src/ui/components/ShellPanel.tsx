import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { useEffect, useRef, useState } from 'react'

export interface ShellTarget {
  context: string
  namespace: string
  pod: string
  container: string
}

/** Pod Shell (P5): xterm.js wired to a PTY in the main process. Opened only by the user. */
export function ShellPanel({ target, onClose }: { target: ShellTarget; onClose(): void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'opening' | 'open' | 'closed' | string>('opening')

  useEffect(() => {
    const term = new Terminal({ fontSize: 12, fontFamily: 'SF Mono, Menlo, monospace', cursorBlink: true, convertEol: false })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(hostRef.current!)
    fit.fit()
    let shellId: string | undefined
    let disposed = false

    const offData = window.logdeck.onShellData((e) => {
      if (e.shellId === shellId) term.write(e.data)
    })
    const offExit = window.logdeck.onShellExit((e) => {
      if (e.shellId !== shellId) return
      term.write(`\r\n[sessão encerrada, código ${e.code}]\r\n`)
      setState('closed')
    })
    const input = term.onData((data) => {
      if (shellId) void window.logdeck.shellInput(shellId, data)
    })
    const observer = new ResizeObserver(() => {
      fit.fit()
      if (shellId) void window.logdeck.shellResize(shellId, term.cols, term.rows)
    })
    observer.observe(hostRef.current!)

    window.logdeck
      .openShell({ ...target, cols: term.cols, rows: term.rows })
      .then((id) => {
        if (disposed) return void window.logdeck.closeShell(id)
        shellId = id
        setState('open')
        term.focus()
      })
      .catch((err: Error) => {
        term.write(`\r\n${err.message}\r\n`)
        setState(err.message)
      })

    return () => {
      disposed = true
      observer.disconnect()
      input.dispose()
      offData()
      offExit()
      if (shellId) void window.logdeck.closeShell(shellId)
      term.dispose()
    }
  }, [target])

  return (
    <section className="shell" aria-label="Pod Shell">
      <div className="shell-head">
        <span>
          ⌨ Shell: {target.pod} / {target.container} <span className="muted">({state === 'open' ? 'conectado' : state === 'opening' ? 'abrindo…' : state})</span>
        </span>
        <button onClick={onClose}>Fechar</button>
      </div>
      <div ref={hostRef} className="shell-term" data-testid="shell-term" />
    </section>
  )
}
