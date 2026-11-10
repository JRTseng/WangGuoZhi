import { expect, test, type Page } from '@playwright/test';

/** 遊戲座標 → 頁面座標（FIT 縮放後的 canvas 位置） */
async function tapGame(page: Page, x: number, y: number) {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('找不到 canvas');
  const s = box.width / 390;
  await page.mouse.click(box.x + x * s, box.y + y * s);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__WGZ__?.scene === 'MainScene');
});

test('主畫面顯示資源列、5 隻角色與出征按鈕', async ({ page }) => {
  const state = await page.evaluate(() => window.__WGZ__);
  expect(state?.resources).toEqual({ food: 1200, bones: 50 });
  expect(state?.cards?.map((c) => c.name)).toEqual(['大耳', '黑旋', '長鬚', '小算', '阿白']);
  expect(state?.expeditionButton?.label).toBe('出征（即將開放）');

  // 390 x 844 下卡片不重疊、不超出畫面，也不壓到出征按鈕
  const cards = state!.cards!;
  const btn = state!.expeditionButton!;
  for (const c of cards) {
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.y).toBeGreaterThanOrEqual(0);
    expect(c.x + c.width).toBeLessThanOrEqual(390);
    expect(c.y + c.height).toBeLessThanOrEqual(btn.y);
    expect(c.power).toBeGreaterThan(0);
  }
  for (let i = 1; i < cards.length; i++) {
    expect(cards[i].y).toBeGreaterThanOrEqual(cards[i - 1].y + cards[i - 1].height);
  }

  await page.screenshot({ path: 'artifacts/screenshots/main.png' });
});

test('點卡片開啟角色面板，再點一下關閉', async ({ page }) => {
  const cards = (await page.evaluate(() => window.__WGZ__?.cards))!;
  const target = cards[1]; // 黑旋

  await tapGame(page, target.x + target.width / 2, target.y + target.height / 2);
  await page.waitForFunction((id) => window.__WGZ__?.panel === id, target.id);
  await page.screenshot({ path: 'artifacts/screenshots/main-panel.png' });

  await tapGame(page, 195, 422);
  await page.waitForFunction(() => window.__WGZ__?.panel === null);

  // 換一隻也能開
  const other = cards[4];
  await tapGame(page, other.x + other.width / 2, other.y + other.height / 2);
  await page.waitForFunction((id) => window.__WGZ__?.panel === id, other.id);
});
