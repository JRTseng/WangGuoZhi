import { expect, test, type Page } from '@playwright/test';
import { openLobby, patchSave, tap, waitScene, wgz } from './helpers';

const W = 844;
const H = 390;
const SHOTS = 'artifacts/screenshots/rats';
const rats = async (page: Page) => (await wgz(page)).rats!;
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(window.localStorage.getItem('wgz-save')!).state);
const TEAM = ['liuxing', 'xiongyue', 'xueling', 'nuantong', 'songling'];
const maxed = {
  level: 100,
  exp: 0,
  growthAttack: 1500,
  growthDefense: 1500,
  bonusAttack: 0,
  bonusDefense: 0,
  rolls: 0,
  star: 5,
};

test('老鼠幫：第一章前主頁沒有按鈕；出現後打贏拿一堆寶物，一天三波打完就收工', async ({ page }) => {
  await openLobby(page, '?fast=1');
  expect((await wgz(page)).lobby!.buttons.rats).toBeUndefined();

  const s = await saved(page);
  await patchSave(page, {
    owned: [...s.owned, ...TEAM],
    dogs: { ...s.dogs, ...Object.fromEntries(TEAM.map((id) => [id, maxed])) },
    team: TEAM,
    cleared: ['luoyepo-5', 'zhulindu-1'],
    settings: { ...s.settings, skipBattle: true },
  });
  const btn = (await wgz(page)).lobby!.buttons.rats;
  expect(btn).toBeTruthy();
  expect(btn.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: `${SHOTS}/rats-lobby.png` });
  await tap(page, btn);
  await waitScene(page, 'RatScene');
  let r = await rats(page);
  // 主線打到第 2 章，所以是第 2 級
  expect(r).toMatchObject({ open: true, tier: 2, wavesLeft: 3, total: 0 });
  expect(r.fight!.x + r.fight!.width).toBeLessThanOrEqual(W);
  expect(r.fight!.y + r.fight!.height).toBeLessThanOrEqual(H);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/rats-scene.png` });

  // 第一波：選隊伍 → 開戰（略過戰鬥畫面）→ 結算
  const before = await saved(page);
  await tap(page, r.fight!);
  await waitScene(page, 'ExpeditionScene');
  await tap(page, (await wgz(page)).expeditionPanel!.confirmButton!);
  await page.waitForFunction(() => !!window.__WGZ__?.result);
  expect((await wgz(page)).result!.win).toBe(true);
  let st = await saved(page);
  expect(st.rats).toMatchObject({ wins: 1, total: 1 });
  expect(st.cleared).not.toContain('rat-2');
  const loot = st.history[st.history.length - 1].loot;
  expect(loot.length).toBeGreaterThanOrEqual(2);
  // 第一樣一定是裝備
  expect(loot[0].kind).toBe('gear');
  const gearCount = (x: { gear: Record<string, number> }) =>
    Object.values(x.gear).reduce((a, b) => a + b, 0);
  expect(gearCount(st)).toBeGreaterThan(gearCount(before));
  await page.screenshot({ path: `${SHOTS}/rats-win.png` });

  // 「下一關」接著打第二、第三波；第三波打完就沒有下一波
  await tap(page, (await wgz(page)).nextButton!);
  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem('wgz-save');
    return !!raw && JSON.parse(raw).state.rats.wins === 2;
  });
  await page.waitForFunction(() => !!window.__WGZ__?.nextButton);
  await tap(page, (await wgz(page)).nextButton!);
  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem('wgz-save');
    return !!raw && JSON.parse(raw).state.rats.wins === 3;
  });
  await page.waitForFunction(() => !!window.__WGZ__?.result);
  expect((await wgz(page)).nextButton ?? null).toBeNull();
  st = await saved(page);
  expect(st.rats).toMatchObject({ wins: 3, total: 3 });

  // 回活動畫面：今天沒有波數了，不能再出擊
  await page.mouse.click(8, H - 8);
  await waitScene(page, 'RatScene');
  r = await rats(page);
  expect(r).toMatchObject({ wavesLeft: 0, total: 3, fight: null });
  await page.screenshot({ path: `${SHOTS}/rats-done.png` });
});

test('老鼠幫：戰鬥畫面裡的老鼠照新畫法出場', async ({ page }) => {
  await openLobby(page, '?fast=1');
  const s = await saved(page);
  await patchSave(page, {
    owned: [...s.owned, ...TEAM],
    dogs: { ...s.dogs, ...Object.fromEntries(TEAM.map((id) => [id, maxed])) },
    team: TEAM,
    cleared: ['luoyepo-5', 'zhulindu-5', 'xuelingguan-5', 'taohuayuan-1'].slice(0, 3),
  });
  await tap(page, (await wgz(page)).lobby!.buttons.rats);
  await waitScene(page, 'RatScene');
  await tap(page, (await rats(page)).fight!);
  await waitScene(page, 'ExpeditionScene');
  await tap(page, (await wgz(page)).expeditionPanel!.confirmButton!);
  await waitScene(page, 'BattleScene');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/rats-battle.png` });
});
