import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/api-*.spec.ts',
  fullyParallel: true,
  workers: 3,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:5188', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5188',
    url: 'http://127.0.0.1:5188',
    env: { VITE_DATA_SOURCE: 'demo' },
    reuseExistingServer: false,
  },
});
