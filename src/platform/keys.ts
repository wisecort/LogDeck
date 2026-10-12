// Shortcut labels: macOS symbols on a Mac, Ctrl/Shift/Alt elsewhere. Pure, shared by main and renderer.

export const isMacUserAgent = (ua: string): boolean => /Mac/i.test(ua)

export function platformKeys(text: string, mac: boolean): string {
  if (mac) return text
  return text.replace(/⌘\s?/g, 'Ctrl+').replace(/⇧\s?/g, 'Shift+').replace(/⌥/g, 'Alt')
}
