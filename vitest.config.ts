import { defineConfig } from 'vitest/config'

const STRICT = { lines: 90, functions: 90, branches: 90, statements: 90 }

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          testTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/logs/**', 'src/k8s/**', 'src/ai/**'],
      reporter: ['text-summary', 'html'],
      thresholds: {
        'src/logs/**': STRICT,
        'src/k8s/args.ts': STRICT,
        'src/ai/redact.ts': STRICT,
      },
    },
  },
})
