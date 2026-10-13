// `make screenshots`: the README pictures (tests/screenshots). Same fakes and safety net as the E2E config.
import { defineConfig } from '@playwright/test'
import base from './playwright.config'

export default defineConfig({ ...base, testDir: 'tests/screenshots' })
