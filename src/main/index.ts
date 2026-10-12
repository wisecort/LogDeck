import { join } from 'node:path'
import { app, BrowserWindow, session, shell } from 'electron'
import { ExplainService } from '../ai/explain'
import { createProvider } from '../ai/providers'
import { Keychain } from '../ai/providers/keychain'
import { K8sService } from '../k8s/service'
import { ShellRegistry } from '../k8s/shell'
import { StreamRegistry } from '../k8s/stream'
import { registerIpc } from './ipc'
import { buildMenu, disableSystemMenuItems } from './menu'
import { AiSettingsStore } from './ai-settings-store'
import { PresetStore } from './presets-store'

const APP_NAME = 'LogDeck'

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ')

app.setName(APP_NAME)
disableSystemMenuItems()
// Tests point userData to a temp dir so they never touch the user's presets.
if (process.env['LOGDECK_USER_DATA']) app.setPath('userData', process.env['LOGDECK_USER_DATA'])

const service = new K8sService()
const registry = new StreamRegistry()
const shells = new ShellRegistry()
let mainWindow: BrowserWindow | undefined

function closeAll(): Promise<void> {
  shells.closeAll()
  return registry.stopAll()
}

function createWindow(): void {
  const win = new BrowserWindow({
    title: APP_NAME,
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 560,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  mainWindow = win
  win.once('ready-to-show', () => win.show())
  // A reload or a closed window must not leave kubectl processes behind (F3.5).
  win.webContents.on('did-start-navigation', (details) => {
    if (details.isMainFrame && !details.isSameDocument) closeAll()
  })
  win.on('closed', () => {
    mainWindow = undefined
    closeAll()
  })

  // The renderer never opens windows or navigates away; external links go to the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event) => event.preventDefault())

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

void app.whenReady().then(() => {
  if (app.isPackaged) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [CSP] } })
    })
  }
  const presets = new PresetStore(join(app.getPath('userData'), 'presets.json'))
  const aiSettings = new AiSettingsStore(join(app.getPath('userData'), 'ai.json'))
  // Tests point this at a fake `security` so they never read the user's Keychain.
  const keychain = new Keychain({ ...(process.env['LOGDECK_SECURITY_BIN'] && { binary: process.env['LOGDECK_SECURITY_BIN'] }) })
  const explain = new ExplainService({ provider: () => createProvider(aiSettings.get(), { keychain }) })
  registerIpc({ service, registry, shells, presets, aiSettings, keychain, explain, trusted: () => mainWindow?.webContents, onLanguage: (lang) => buildMenu(APP_NAME, lang) })
  buildMenu(APP_NAME)
  // Packaged apps get build/icon.icns from electron-builder; in `make dev` show the same icon in the Dock.
  if (!app.isPackaged) app.dock?.setIcon(join(app.getAppPath(), 'build/icon.png'))
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => app.quit())

let quitting = false
app.on('before-quit', (event) => {
  if (quitting || (registry.size === 0 && shells.size === 0)) return
  event.preventDefault()
  quitting = true
  void closeAll().finally(() => app.quit())
})
