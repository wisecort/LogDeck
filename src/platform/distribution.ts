// How this copy of LogDeck was installed (G10: platform code lives here).

/** True when running from the Microsoft Store (MSIX) package; Electron sets `process.windowsStore` there. */
export function isStoreBuild(proc: { windowsStore?: boolean } = process): boolean {
  return proc.windowsStore === true
}
