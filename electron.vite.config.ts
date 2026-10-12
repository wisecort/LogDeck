import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

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
  },
})
