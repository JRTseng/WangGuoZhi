import { expect, test, type Page } from '@playwright/test';
import { openLobby, patchSave, tap, waitScene, wgz } from './helpers';

const W = 844;
const H = 390;
const SHOTS = 'artifacts/screenshots/tower';
const tower = async (page: Page) => (await wgz(page)).tower!;
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

async function openTower(page: Page) {
  await tap(page, (await wgz(page)).lobby!.buttons.event);
  await waitScene(page, 'TowerScene');
}

test('登天塔：第三章前鎖著；開放後挑戰下一層、打贏往上、接著打下一層', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await openTower(page);
  let t = await tower(page);
  expect(t).toMatchObject({ open: false, floor: 0, next: 1, fight: null, sweep: null });
  await page.screenshot({ path: `${SHOTS}/tower-locked.png` });
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');

  const s = await saved(page);
  await patchSave(page, {
    owned: [...s.owned, ...TEAM],
    dogs: { ...s.dogs, ...Object.fromEntries(TEAM.map((id) => [id, maxed])) },
    team: TEAM,
    cleared: ['luoyepo-5', 'zhulindu-5', 'xuelingguan-5'].filter(Boolean),
    settings: { ...s.settings, skipBattle: true },
  });
  await openTower(page);
  t = await tower(page);
  expect(t).toMatchObject({ open: true, floor: 0, next: 1, sweep: null });
  expect(t.fight!.height).toBeGreaterThanOrEqual(44);
  expect(t.fight!.x + t.fight!.width).toBeLessThanOrEqual(W);
  expect(t.fight!.y + t.fight!.height).toBeLessThanOrEqual(H);
  await page.screenshot({ path: `${SHOTS}/tower-floor1.png` });

  // 挑戰第 1 層：選隊伍 → 開戰（略過戰鬥畫面）→ 結算
  await tap(page, t.fight!);
  await waitScene(page, 'ExpeditionScene');
  await tap(page, (await wgz(page)).expeditionPanel!.confirmButton!);
  await page.waitForFunction(() => !!window.__WGZ__?.result);
  expect((await wgz(page)).result!.win).toBe(true);
  expect((await saved(page)).tower.floor).toBe(1);
  await page.screenshot({ path: `${SHOTS}/tower-win.png` });

  // 「下一關」直接打第 2 層
  await tap(page, (await wgz(page)).nextButton!);
  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem('wgz-save');
    return !!raw && JSON.parse(raw).state.tower.floor === 2;
  });
  expect((await saved(page)).cleared).not.toContain('tower-1');
});

test('登天塔：換週後一鍵通關到上週的進度並領完獎勵；到限定裝備那一層就送', async ({ page }) => {
  await openLobby(page, '?fast=1');
  const s = await saved(page);
  await patchSave(page, {
    owned: [...s.owned, ...TEAM],
    dogs: { ...s.dogs, ...Object.fromEntries(TEAM.map((id) => [id, maxed])) },
    team: TEAM,
    cleared: ['luoyepo-5', 'zhulindu-5', 'xuelingguan-5'],
    settings: { ...s.settings, skipBattle: true },
    // 很久以前的那一週爬到 19 層
    tower: { week: '2020-01-06', floor: 19, last: 0, best: 19, gear: [] },
  });
  await openTower(page);
  let t = await tower(page);
  expect(t).toMatchObject({ open: true, floor: 0, last: 19, next: 1, sweepTo: 19 });
  expect(t.sweep!.height).toBeGreaterThanOrEqual(44);
  expect(t.sweep!.x + t.sweep!.width).toBeLessThanOrEqual(t.fight!.x);
  await page.screenshot({ path: `${SHOTS}/tower-sweep.png` });

  const before = (await wgz(page)).resources!;
  await tap(page, t.sweep!);
  await page.waitForFunction(() => window.__WGZ__?.tower?.floor === 19);
  t = await tower(page);
  expect(t).toMatchObject({ floor: 19, next: 20, sweep: null });
  const after = (await wgz(page)).resources!;
  // 第 1～19 層：糧草 (200+20n)，第 10 層三倍
  let food = 0;
  for (let n = 1; n <= 19; n++) food += (200 + 20 * n) * (n === 10 ? 3 : 1);
  expect(after.food - before.food).toBe(food);
  await page.screenshot({ path: `${SHOTS}/tower-swept.png` });

  // 打第 20 層（守關頭目）：送限定裝備
  await tap(page, t.fight!);
  await waitScene(page, 'ExpeditionScene');
  await tap(page, (await wgz(page)).expeditionPanel!.confirmButton!);
  await page.waitForFunction(() => !!window.__WGZ__?.result);
  expect((await wgz(page)).result!.win).toBe(true);
  const st = await saved(page);
  expect(st.tower).toMatchObject({ floor: 20, best: 20, gear: [20] });
  expect(st.gear['tw-20']).toBe(1);
  await page.screenshot({ path: `${SHOTS}/tower-gear.png` });
});
