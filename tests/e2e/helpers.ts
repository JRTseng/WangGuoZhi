import type { Page } from '@playwright/test';

export interface R {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const wgz = (page: Page) => page.evaluate(() => window.__WGZ__!);

/** 點遊戲座標中某個矩形的中心（FIT 縮放後換算成頁面座標，直式、橫式都適用） */
export async function tap(page: Page, r: R, fx = 0.5, fy = 0.5) {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('找不到 canvas');
  const gw = await page.evaluate(() => window.__WGZ__?.size?.width ?? 390);
  const s = box.width / gw;
  await page.mouse.click(box.x + (r.x + r.width * fx) * s, box.y + (r.y + r.height * fy) * s);
}

export async function waitScene(page: Page, scene: string) {
  await page.waitForFunction((s) => window.__WGZ__?.scene === s, scene);
}

/** 開遊戲並等到主頁 */
export async function openLobby(page: Page, query = '') {
  await page.goto(`/${query}`);
  await waitScene(page, 'LobbyScene');
}
