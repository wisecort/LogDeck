// ANSI escape sequences are removed before parsing and rendering (F3.6): logs stay plain text.
// eslint-disable-next-line no-control-regex -- matching escape sequences is the point
const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)|\u001b[@-Z\\-_]/g

export function stripAnsi(text: string): string {
  return text.includes('\u001b') ? text.replace(ANSI, '') : text
}
