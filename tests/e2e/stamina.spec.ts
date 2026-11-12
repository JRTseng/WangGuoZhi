import { expect, test, type Page } from '@playwright/test';
import {
  battleFromMap,
  enableSkipBattle,
  openLobby,
  startBattle,
  tap,
  waitScene,
  wgz,
} from './helpers';

const CLOSE = { x: 0, y: 800, width: 390, height: 20 };

/** 結算出現後關掉；第一次過關會先播劇情，略過後從主頁回到地圖 */
async function closeResult(page: Page, firstClear: boolean) {
  await page.waitForFunction(() => !!window.__WGZ__?.result);
  await tap(page, CLOSE);
  if (firstClear) {
    await waitScene(page, 'StoryScene');
    await tap(page, (await wgz(page)).story!.skip!);
    await waitScene(page, 'LobbyScene');
    await tap(page, (await wgz(page)).lobby!.buttons.expedition);
  }
  await waitScene(page, 'CampaignScene');
}

/** 在地圖打開某一關的選隊伍畫面 */
async function openStage(page: Page, nodeIndex: number) {
  await tap(page, (await wgz(page)).map!.nodes[nodeIndex]);
  await page.waitForFunction(() => !!window.__WGZ__?.map?.stagePanel);
  await tap(page, (await wgz(page)).map!.stagePanel!.go);
  await waitScene(page, 'ExpeditionScene');
}

test('體力與每日次數：打 3 次用完次數、體力打完要等，骨頭幣可以補', async ({ page }) => {
  test.setTimeout(90_000);
  // 不開測試模式：體力 5 分鐘才回 1 點，數字不會在測試途中變動
  await openLobby(page);
  await enableSkipBattle(page);

  // 第 1 關打 3 次：體力 100 → 40，次數 3 → 0
  await startBattle(page, 0);
  await closeResult(page, true);
  await battleFromMap(page, 0);
  await closeResult(page, false);
  await tap(page, (await wgz(page)).map!.nodes[0]);
  await page.waitForFunction(() => !!window.__WGZ__?.map?.stagePanel);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/stage-stamina.png' });
  await tap(page, (await wgz(page)).map!.stagePanel!.go);
  await waitScene(page, 'ExpeditionScene');
  expect((await wgz(page)).expeditionPanel!.runsLeft).toBe(1);
  await tap(page, (await wgz(page)).expeditionPanel!.confirmButton!);
  await closeResult(page, false);

  // 次數用完：按鈕變灰、顯示重置倒數、旁邊出現「加次數」
  await openStage(page, 0);
  let s = await wgz(page);
  expect(s.stamina).toEqual({ value: 40, max: 100 });
  expect(s.resources).toEqual({ food: 1200 + 360, bones: 65 });
  let e = s.expeditionPanel!;
  expect(e.runsLeft).toBe(0);
  expect(e.confirmButton!.enabled).toBe(false);
  expect(e.confirmButton!.label).toMatch(/^次數用完 \d+:\d\d(:\d\d)?$/);
  expect(e.buyButton).toMatchObject({ kind: 'runs' });
  expect(e.buyButton!.x).toBeGreaterThanOrEqual(e.confirmButton!.x + e.confirmButton!.width);
  expect(e.buyButton!.x + e.buyButton!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/no-runs.png' });
  // 灰掉的按鈕點了沒反應
  await tap(page, e.confirmButton!);
  expect((await wgz(page)).result ?? null).toBeNull();

  // 加購 1 次：15 骨頭幣
  await tap(page, e.buyButton!);
  await page.waitForFunction(() => !!window.__WGZ__?.shop);
  let shop = (await wgz(page)).shop!;
  expect(shop).toMatchObject({ kind: 'runs', enabled: true, left: 5 });
  await page.screenshot({ path: 'artifacts/screenshots/portrait/shop-runs.png' });
  await tap(page, shop.ok);
  await page.waitForFunction(() => window.__WGZ__?.shop?.left === 4);
  await tap(page, (await wgz(page)).shop!.cancel);
  await page.waitForFunction(() => !window.__WGZ__?.shop);
  s = await wgz(page);
  expect(s.resources!.bones).toBe(50);
  e = s.expeditionPanel!;
  expect(e).toMatchObject({ runsLeft: 1, buyButton: null });
  expect(e.confirmButton).toMatchObject({ label: '開戰！', enabled: true });

  // 第 2 關打 2 次：體力 40 → 0
  await tap(page, s.backButton!);
  await battleFromMap(page, 1);
  await closeResult(page, false);
  await battleFromMap(page, 1);
  await closeResult(page, false);

  // 體力不足：按鈕變灰、顯示還要等多久（還差 20 點 = 100 分鐘）、旁邊出現「補體力」
  await openStage(page, 1);
  s = await wgz(page);
  expect(s.stamina!.value).toBe(0);
  e = s.expeditionPanel!;
  expect(e.runsLeft).toBe(1);
  expect(e.confirmButton!.enabled).toBe(false);
  expect(e.confirmButton!.label).toMatch(/^體力不足 1:3\d:\d\d$/);
  expect(e.buyButton).toMatchObject({ kind: 'stamina' });
  await page.screenshot({ path: 'artifacts/screenshots/portrait/no-stamina.png' });

  // 補體力：30 骨頭幣換 60；買 2 次後骨頭幣不夠（50 + 12 × 2 = 74 → 14）
  await tap(page, e.buyButton!);
  await page.waitForFunction(() => !!window.__WGZ__?.shop);
  shop = (await wgz(page)).shop!;
  expect(shop).toMatchObject({ kind: 'stamina', enabled: true, left: 3 });
  await page.screenshot({ path: 'artifacts/screenshots/portrait/shop-stamina.png' });
  await tap(page, shop.ok);
  await page.waitForFunction(() => window.__WGZ__?.shop?.left === 2);
  await tap(page, shop.ok);
  await page.waitForFunction(() => window.__WGZ__?.shop?.left === 1);
  shop = (await wgz(page)).shop!;
  expect(shop).toMatchObject({ enabled: false, message: '骨頭幣不夠' });
  await tap(page, shop.ok);
  await tap(page, shop.cancel);
  await page.waitForFunction(() => !window.__WGZ__?.shop);
  s = await wgz(page);
  expect(s.resources!.bones).toBe(14);
  // 買的可以超過上限
  expect(s.stamina).toEqual({ value: 120, max: 100 });
  expect(s.expeditionPanel!.confirmButton).toMatchObject({ label: '開戰！', enabled: true });
});

test('自動出征：預設關，打開後自動打已通過的關卡，結果累積成摘要', async ({ page }) => {
  await openLobby(page);
  let s = await wgz(page);
  expect(s.auto).toMatchObject({ enabled: false, runs: 0, banner: null });

  // 還沒通過任何關卡：打開也不會打
  await tap(page, s.auto!.toggle);
  await page.waitForFunction(() => window.__WGZ__?.auto?.enabled === true);
  await page.waitForTimeout(600);
  s = await wgz(page);
  expect(s.auto).toMatchObject({ runs: 0, banner: null });
  expect(s.stamina!.value).toBe(100);
  // 關掉
  await tap(page, s.auto!.toggle);
  await page.waitForFunction(() => window.__WGZ__?.auto?.enabled === false);

  // 先手動通過第 1 關（體力剩 80）
  await enableSkipBattle(page);
  await startBattle(page, 0);
  await page.waitForFunction(() => !!window.__WGZ__?.result);
  await tap(page, CLOSE);
  await waitScene(page, 'StoryScene');
  await tap(page, (await wgz(page)).story!.skip!);
  await waitScene(page, 'LobbyScene');
  expect((await wgz(page)).stamina!.value).toBe(80);

  // 打開自動出征：第 1 關今天還剩 2 次，自動打 2 場，體力剩 40
  await tap(page, (await wgz(page)).auto!.toggle);
  await page.waitForFunction(() => window.__WGZ__?.auto?.runs === 2);
  s = await wgz(page);
  expect(s.scene).toBe('LobbyScene');
  expect(s.stamina!.value).toBe(40);
  expect(s.resources).toEqual({ food: 1200 + 360, bones: 65 });
  expect(s.auto!.banner).not.toBeNull();
  for (const r of [s.auto!.banner!, s.auto!.toggle, s.status!]) {
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(390);
  }
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/lobby-auto.png' });

  // 看摘要，關掉後提示消失
  await tap(page, s.auto!.banner!);
  await page.waitForFunction(() => !!window.__WGZ__?.autoSummary);
  expect((await wgz(page)).autoSummary).toEqual({
    runs: 2,
    wins: 2,
    food: 240,
    bones: 10,
    stages: { 'luoyepo-1': 2 },
  });
  await page.screenshot({ path: 'artifacts/screenshots/portrait/auto-summary.png' });
  await tap(page, CLOSE);
  await page.waitForFunction(() => !window.__WGZ__?.autoSummary);
  await page.waitForFunction(() => window.__WGZ__?.auto?.runs === 0);
  expect((await wgz(page)).auto).toMatchObject({ enabled: true, banner: null });
});

test.describe('手機橫放', () => {
  const W = 844;
  const H = 390;
  test.use({ viewport: { width: W, height: H } });

  test('體力不足時的選隊伍畫面與主頁自動出征（橫式）', async ({ page }) => {
    await openLobby(page);
    await enableSkipBattle(page);
    await startBattle(page, 0);
    await page.waitForFunction(() => !!window.__WGZ__?.result);
    await tap(page, { x: 0, y: 380, width: W, height: 6 });
    await waitScene(page, 'StoryScene');
    await tap(page, (await wgz(page)).story!.skip!);
    await waitScene(page, 'LobbyScene');
    await tap(page, (await wgz(page)).auto!.toggle);
    await page.waitForFunction(() => window.__WGZ__?.auto?.runs === 2);
    const s = await wgz(page);
    for (const r of [s.auto!.banner!, s.auto!.toggle, s.status!]) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(W);
      expect(r.y + r.height).toBeLessThanOrEqual(H);
    }
    await page.waitForTimeout(1800);
    await page.screenshot({ path: 'artifacts/screenshots/landscape/lobby-auto.png' });

    // 第 1 關次數用完
    await tap(page, s.lobby!.buttons.expedition);
    await waitScene(page, 'CampaignScene');
    await openStage(page, 0);
    const e = (await wgz(page)).expeditionPanel!;
    expect(e.confirmButton!.enabled).toBe(false);
    expect(e.buyButton).toMatchObject({ kind: 'runs' });
    for (const r of [e.confirmButton!, e.buyButton!]) {
      expect(r.x + r.width).toBeLessThanOrEqual(W);
      expect(r.y + r.height).toBeLessThanOrEqual(H);
    }
    await page.screenshot({ path: 'artifacts/screenshots/landscape/no-runs.png' });
  });
});
