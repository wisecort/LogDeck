import { contextBridge } from 'electron'
import type { LogDeckApi } from './api'

// Narrow, typed surface exposed to the renderer. Grows phase by phase (SPEC §2).
const api: LogDeckApi = {
  appName: 'LogDeck',
}

contextBridge.exposeInMainWorld('logdeck', api)
