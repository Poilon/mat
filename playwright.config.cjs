const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  testMatch: '*.spec.cjs',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: { baseURL: 'http://localhost:4173', browserName: 'chromium', headless: true, viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' },
  webServer: { command: 'python3 -m http.server 4173 --bind 127.0.0.1', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI },
  reporter: 'list'
});
