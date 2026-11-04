import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/api-*.spec.ts',
  workers: 1,
  retries: 0,
  outputDir: '../artifacts/persistencia-api/playwright',
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5173', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    env: { VITE_DATA_SOURCE: 'api' },
    reuseExistingServer: true,
  },
});
