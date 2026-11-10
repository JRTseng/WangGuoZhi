import { expect, test } from '@playwright/test';

test('開機畫面顯示標題與版本號', async ({ page }) => {
  await page.goto('/?stay=boot');
  await page.waitForFunction(() => window.__WGZ__?.scene === 'BootScene');

  const version = await page.evaluate(() => window.__WGZ__?.version);
  expect(version).toMatch(/^v\d+\.\d+\.\d+/);

  // 畫布要填滿直式寬度
  const box = await page.locator('canvas').boundingBox();
  expect(box?.width).toBeCloseTo(390, 0);

  await page.screenshot({ path: 'artifacts/screenshots/boot.png' });
});
