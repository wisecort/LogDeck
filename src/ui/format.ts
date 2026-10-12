const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** Local HH:MM:SS.mmm */
export function formatTime(ms: number | undefined): string {
  if (ms === undefined) return '—'
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

/** Local DD/MM HH:MM:SS */
export function formatDateTime(ms: number | undefined): string {
  if (ms === undefined) return '—'
  const d = new Date(ms)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** Splits the exclusion field: one term per line or comma. */
export function parseTerms(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((t) => t.trim())
    .filter(Boolean)
}
