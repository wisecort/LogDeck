// Browser RegexRunner for searchWithTimeout: a Blob Web Worker terminated on timeout (F5.4).
// A Blob avoids loading worker scripts from file:// in the packaged app; CSP allows `worker-src blob:`.
import type { RegexRunner } from '../logs/search'

const WORKER_SOURCE = `
onmessage = (event) => {
  const { texts, source, flags } = event.data
  const re = new RegExp(source, flags)
  const out = []
  for (let i = 0; i < texts.length; i++) if (re.test(texts[i])) out.push(i)
  postMessage(out)
}
`

let workerUrl: string | undefined

export const browserRegexRunner: RegexRunner = (texts, source, flags, timeoutMs) =>
  new Promise((resolve, reject) => {
    workerUrl ??= URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }))
    const worker = new Worker(workerUrl)
    const timer = setTimeout(() => {
      worker.terminate()
      resolve(null)
    }, timeoutMs)
    worker.onmessage = (event: MessageEvent<number[]>) => {
      clearTimeout(timer)
      worker.terminate()
      resolve(event.data)
    }
    worker.onerror = (event) => {
      clearTimeout(timer)
      worker.terminate()
      reject(new Error(event.message))
    }
    worker.postMessage({ texts, source, flags })
  })
