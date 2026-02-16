import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['ui/**/*.test.{ts,tsx}', 'jsdom'],
      ['tests/integration/**/*.test.ts', 'node'],
    ],
    exclude: ['e2e/**', 'node_modules/**', 'docs/**'],
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts', 'ui/**/*.{ts,tsx}'],
      exclude: ['src/types.ts', 'src/index.ts', 'ui/components/__tests__/**'],
      thresholds: {
        // TODO: measure actual coverage after Phases B+C integration tests merge,
        // then raise thresholds if justified. Do NOT raise preemptively.
        lines: 70,
        statements: 70,
        branches: 55,
        functions: 75,
      },
    },
  },
  resolve: {
    alias: {
      '@': './src',
      '@ui': './ui',
    },
  },
});
