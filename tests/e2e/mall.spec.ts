import { expect, test, type Page } from '@playwright/test';
import { openLobby, patchSave, tap, waitScene, wgz } from './helpers';

const W = 844;
const H = 390;
const SHOTS = 'artifacts/screenshots/mall';
const mall = async (page: Page) => (await wgz(page)).mall!;

async function openMall(page: Page) {
  await tap(page, (await wgz(page)).lobby!.buttons.shop);
  await waitScene(page, 'MallScene');
}

test('商城：主頁進來，一批六樣，領每日禮物，錢不夠買不了', async ({ page }) => {
  await openLobby(page, '?fast=1');
  // 今天的每日禮物還沒領，「商城」亮紅點
  await page.waitForFunction(() => window.__WGZ__?.lobby?.mallReady === true);
  await page.screenshot({ path: `${SHOTS}/mall-lobby-dot.png` });
  await openMall(page);

  let m = await mall(page);
  expect(m.goods.map((g) => g.kind)).toEqual([
    'gift',
    'snack',
    'snackPack',
    'shards',
    'rareShards',
    'gear',
  ]);
  for (const g of m.goods) {
    expect(g.x).toBeGreaterThanOrEqual(0);
    expect(g.x + g.width).toBeLessThanOrEqual(W);
    expect(g.y + g.height).toBeLessThanOrEqual(H);
    expect(g.height).toBeGreaterThanOrEqual(44);
    expect(g.left).toBe(g.limit);
  }
  expect(m.goods[0]).toMatchObject({ currency: 'free', text: '糧草 200', block: null });
  expect(m.goods[1]).toMatchObject({ currency: 'food', price: 600, text: '小肉乾 ×3' });
  await page.screenshot({ path: `${SHOTS}/mall-new.png` });

  // 領每日禮物：糧草 +200，那一格變成領過了
  const before = (await wgz(page)).resources!;
  await tap(page, m.goods[0]);
  await page.waitForFunction(() => window.__WGZ__?.mall?.goods[0].left === 0);
  expect((await wgz(page)).resources).toEqual({ food: before.food + 200, bones: before.bones });
  m = await mall(page);
  expect(m.goods[0].block).toBe('sold-out');
  expect(m.toast).toBe('領取：糧草 200');
  await page.screenshot({ path: `${SHOTS}/mall-gift-claimed.png` });
  // 再點一次沒有反應
  await tap(page, m.goods[0]);
  await page.waitForTimeout(200);
  expect((await wgz(page)).resources).toEqual({ food: before.food + 200, bones: before.bones });

  // 買零食：糧草 1,400 夠買兩次，第三次不夠
  await tap(page, m.goods[1]);
  await page.waitForFunction(() => window.__WGZ__?.mall?.goods[1].left === 2);
  await tap(page, m.goods[1]);
  await page.waitForFunction(() => window.__WGZ__?.mall?.goods[1].left === 1);
  m = await mall(page);
  expect((await wgz(page)).resources!.food).toBe(before.food + 200 - 1200);
  expect(m.goods[1].block).toBe('food');
  await tap(page, m.goods[1]);
  await page.waitForFunction(() => window.__WGZ__?.mall?.toast === '糧草不夠');
  expect((await mall(page)).goods[1].left).toBe(1);
  await page.screenshot({ path: `${SHOTS}/mall-short.png` });

  // 回主頁紅點消失；重新整理後今天買過的還記得
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  await page.waitForFunction(() => window.__WGZ__?.lobby?.mallReady === false);
  await page.reload();
  await waitScene(page, 'LobbyScene');
  await openMall(page);
  m = await mall(page);
  expect(m.goods[0].left).toBe(0);
  expect(m.goods[1].left).toBe(1);
});

test('商城：骨頭幣夠的時候，碎片、裝備、零食大包都買得到，買到上限就賣完', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await patchSave(page, { resources: { food: 50000, bones: 5000 } });
  await openMall(page);
  let m = await mall(page);
  expect(m.goods.every((g) => g.block === null)).toBe(true);
  await page.screenshot({ path: `${SHOTS}/mall-rich.png` });

  let bones = 5000;
  for (const slot of [2, 3, 4, 5]) {
    const g = m.goods[slot];
    expect(g.currency).toBe('bones');
    for (let i = 1; i <= g.limit; i++) {
      await tap(page, g);
      await page.waitForFunction(
        ([s, left]) => window.__WGZ__?.mall?.goods[s].left === left,
        [slot, g.limit - i],
      );
      bones -= g.price;
    }
  }
  m = await mall(page);
  expect((await wgz(page)).resources!.bones).toBe(bones);
  for (const slot of [2, 3, 4, 5]) expect(m.goods[slot].block).toBe('sold-out');
  await page.screenshot({ path: `${SHOTS}/mall-sold-out.png` });

  // 主頁資源列也進得來
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
});
