import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'artifacts/test-results',
  fullyParallel: true,
  // 長流程測試（跨好幾個畫面、每步截圖）在 CI 上約 25～30 秒，預設 30 秒太緊
  timeout: 60_000,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    browserName: 'chromium',
    // 模擬 iPhone 直式尺寸
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  webServer: {
    // CI 會先跑 npm run build，本機則自動建置
    command: process.env.CI ? 'npm run preview' : 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
