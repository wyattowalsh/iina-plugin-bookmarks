import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [['ui/**/*.test.{ts,tsx}', 'jsdom']],
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts', 'ui/**/*.{ts,tsx}'],
      exclude: ['src/types.ts', 'src/index.ts', 'ui/components/__tests__/**'],
      thresholds: {
        // TODO: raise to 80 after adding cloud-storage tests
        lines: 70,
        // TODO: raise to 80 after adding cloud-storage tests
        statements: 70,
        // TODO: raise to 75 after adding cloud-storage tests
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
