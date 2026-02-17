import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'e2e-report' }], ['list']],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'sidebar',
      testMatch: /sidebar|shared|visual/,
      use: {
        ...devices['Desktop Safari'],
        baseURL: 'http://localhost:1234',
        viewport: { width: 320, height: 600 },
      },
    },
    {
      name: 'overlay',
      testMatch: /overlay|shared|visual/,
      use: {
        ...devices['Desktop Safari'],
        baseURL: 'http://localhost:1235',
        viewport: { width: 400, height: 500 },
      },
    },
    {
      name: 'window',
      testMatch: /window|shared|visual/,
      use: {
        ...devices['Desktop Safari'],
        baseURL: 'http://localhost:1236',
        viewport: { width: 900, height: 700 },
      },
    },
  ],

  webServer: [
    {
      command: 'pnpm run serve-sidebar',
      port: 1234,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'pnpm run serve-overlay',
      port: 1235,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'pnpm run serve-window',
      port: 1236,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
