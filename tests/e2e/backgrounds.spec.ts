import { expect, test } from '@playwright/test';
import { openLobby, patchSave, tap, waitScene, wgz } from './helpers';

const SHOTS = 'artifacts/screenshots/landscape';
const CHAPTERS = [
  'luoyepo',
  'zhulindu',
  'xuelingguan',
  'taohuagu',
  'huangshadao',
  'wuzhaoze',
  'chiyanling',
  'bihaiwan',
  'yundingzhan',
  'wangdu',
];
const ALL_STAGES = CHAPTERS.flatMap((c) => [1, 2, 3, 4, 5].map((n) => `${c}-${n}`));
/** 主頁背景輪流換的順序：十章、主城、燈會 */
const ORDER = [
  'slope',
  'bamboo',
  'snow',
  'peach',
  'desert',
  'marsh',
  'volcano',
  'coast',
  'cloud',
  'palace',
  'city',
  'lantern',
];

test('T016 背景：全破加活動碼後，主頁背景 12 張都能換到，每張各截一張圖', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await patchSave(page, { cleared: ALL_STAGES, redeemedCodes: ['WANGWANG'] });
  const bg = (await wgz(page)).lobby!.buttons.background;
  expect((await wgz(page)).lobby!.background).toBe('slope');
  for (let i = 0; i < ORDER.length; i++) {
    await page.waitForFunction((id) => window.__WGZ__?.lobby?.background === id, ORDER[i]);
    // 截圖裡會帶著「背景：xxx」的提示，剛好看得出是哪一張
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `${SHOTS}/bg-${String(i + 1).padStart(2, '0')}-${ORDER[i]}.png`,
    });
    await tap(page, bg);
  }
  // 繞一圈回到第一張
  await page.waitForFunction(() => window.__WGZ__?.lobby?.background === 'slope');
});

test('T016 背景：低畫質時場景不動，地圖每一章用自己的場景', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await patchSave(page, { cleared: ALL_STAGES, backgroundId: 'coast' });
  expect((await wgz(page)).lobby!.background).toBe('coast');
  // 預設高畫質：雲、浪、海鷗、海面的亮點都會動
  expect((await wgz(page)).lobby!.backgroundMoving).toBeGreaterThan(10);

  // 設定改成低畫質：背景重畫，裡面沒有任何會動的東西
  await tap(page, (await wgz(page)).lobby!.buttons.account);
  await page.waitForFunction(() => !!window.__WGZ__?.settings);
  await tap(page, (await wgz(page)).settings!.rects.low);
  await page.waitForFunction(() => window.__WGZ__?.settings?.values.quality === 'low');
  expect((await wgz(page)).lobby!.backgroundMoving).toBe(0);
  await tap(page, (await wgz(page)).settings!.rects.close);
  await page.waitForFunction(() => !window.__WGZ__?.settings);
  await page.screenshot({ path: `${SHOTS}/bg-low-quality.png` });

  await tap(page, (await wgz(page)).lobby!.buttons.expedition);
  await waitScene(page, 'CampaignScene');
  await page.screenshot({ path: `${SHOTS}/bg-map-ch10.png` });
});
