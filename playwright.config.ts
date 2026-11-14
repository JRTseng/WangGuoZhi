import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'artifacts/test-results',
  fullyParallel: true,
  // 長流程測試（打好幾場、跨好幾個畫面、每步截圖）本機最長約 50 秒，CI 大約慢 1.7 倍，
  // 60 秒會剛好卡在邊緣（2026-11-14 合併後 main 的體力測試因此逾時、沒有部署）
  timeout: 120_000,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    browserName: 'chromium',
    // 模擬 iPhone 橫放的尺寸（遊戲固定橫向）
    viewport: { width: 844, height: 390 },
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
