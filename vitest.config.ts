import { defineConfig } from 'vitest/config';
import packageJson from './package.json';

const coveragePolicy = packageJson.coveragePolicy;

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
        lines: coveragePolicy.lines,
        statements: coveragePolicy.statements,
        branches: coveragePolicy.branches,
        functions: coveragePolicy.functions,
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
