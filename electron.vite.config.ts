import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

const { version } = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string }

export default defineConfig({
  main: {
    build: { lib: { entry: resolve('src/main/index.ts') } },
  },
  preload: {
    build: { lib: { entry: resolve('src/preload/index.ts') } },
  },
  renderer: {
    root: resolve('src/ui'),
    build: { rollupOptions: { input: resolve('src/ui/index.html') } },
    plugins: [react()],
    define: { __APP_VERSION__: JSON.stringify(version) },
  },
})
