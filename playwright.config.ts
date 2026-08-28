import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:8080',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }
  ],
  webServer: {
    command: 'npm run build && DATABASE_URL="sqlite://together-room-e2e.db?mode=rwc" FRONTEND_DIR=dist PORT=8080 cargo run',
    url: 'http://127.0.0.1:8080/health',
    reuseExistingServer: true,
    timeout: 120_000
  }
});
