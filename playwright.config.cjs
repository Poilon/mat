const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  testMatch: '*.spec.cjs',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: { baseURL: 'http://localhost:4176', browserName: 'chromium', headless: true, viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' },
  webServer: { command: 'npm run build && PORT=4176 node scripts/dev.cjs', url: 'http://localhost:4176', reuseExistingServer: !process.env.CI },
  reporter: 'list'
});
