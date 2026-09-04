import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: '../005.项目测试/测试报告/前端/playwright/artifacts',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../005.项目测试/测试报告/前端/playwright/html', open: 'never' }],
    ['junit', { outputFile: '../005.项目测试/测试报告/前端/playwright/junit.xml' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npm run dev:all',
        url: 'http://127.0.0.1:3001/login',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
