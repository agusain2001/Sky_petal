import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'browser-audit.spec.ts',
  workers: 1,
  timeout: 90000,
  outputDir: './evidence/fresh/browser-audit-results',
  reporter: [['list'], ['json', { outputFile: './qa/evidence/fresh/browser-audit.json' }]],
  use: {
    baseURL: process.env.TEST_BASE_URL,
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    // This audit signs in with generated credentials; publish only redacted findings/screenshots.
    trace: 'off',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
});
