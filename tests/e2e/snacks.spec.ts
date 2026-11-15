import { expect, test, type Page } from '@playwright/test';
import {
  battleFromMap,
  enableSkipBattle,
  openLobby,
  patchSave,
  tap,
  waitScene,
  wgz,
} from './helpers';

const SHOTS = 'artifacts/screenshots/landscape';
const CLOSE = { x: 2, y: 190, width: 12, height: 12 };
const ALL = ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'];
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(window.localStorage.getItem('wgz-save')!).state);

test('過關掉經驗零食與裝備，訓練場餵零食會升級', async ({ page }) => {
  await openLobby(page, '?fast=1&seed=7&limits=0');
  await enableSkipBattle(page);
  await tap(page, (await wgz(page)).lobby!.buttons.expedition);
  await battleFromMap(page, 0, ALL);
  await page.waitForFunction(() => !!window.__WGZ__?.result);
  const s = await wgz(page);
  expect(s.result!.win).toBe(true);
  // 第一次過關：一定掉一件裝備，外加小肉乾 1 個
  expect(s.drop).toBeTruthy();
  let st = await saved(page);
  expect(st.snacks).toEqual({ small: 1 });
  expect(Object.keys(st.gear)).toEqual([s.drop]);
  await page.screenshot({ path: `${SHOTS}/snack-result.png` });
  await tap(page, CLOSE);
  await waitScene(page, 'StoryScene');
  await tap(page, (await wgz(page)).story!.skip!);
  await waitScene(page, 'LobbyScene');

  // 訓練場：每隻狗有「零食」按鈕，點了開視窗
  await tap(page, (await wgz(page)).lobby!.buttons.train);
  await waitScene(page, 'TrainingScene');
  let t = (await wgz(page)).training!;
  // 第一列一定在畫面上，不用捲
  const row = t.rows[0];
  const dogId = row.id;
  expect(row.feedButton.x).toBeGreaterThan(row.x);
  expect(row.feedButton.x + row.feedButton.width).toBeLessThan(row.skillLine.x);
  await tap(page, row.feedButton);
  await page.waitForFunction((id) => window.__WGZ__?.training?.feed?.dogId === id, dogId);
  t = (await wgz(page)).training!;
  expect(t.feed!.rows.map((r) => [r.id, r.count, r.enabled])).toEqual([
    ['small', 1, true],
    ['mid', 0, false],
    ['big', 0, false],
  ]);
  for (const r of t.feed!.rows) {
    expect(r.one.height).toBeGreaterThanOrEqual(40);
    expect(r.ten.x + r.ten.width).toBeLessThanOrEqual(844);
  }
  await page.screenshot({ path: `${SHOTS}/snack-feed.png` });

  // 餵一個：小肉乾用掉，經驗 +100、升級
  const level = t.feed!.level;
  await tap(page, t.feed!.rows[0].one);
  await page.waitForFunction(() => window.__WGZ__?.training?.feed?.rows[0].count === 0);
  t = (await wgz(page)).training!;
  expect(t.feed!.level).toBeGreaterThan(level);
  expect(t.feed!.rows[0].enabled).toBe(false);
  expect(t.rows.find((r) => r.id === dogId)!.level).toBe(t.feed!.level);
  await page.screenshot({ path: `${SHOTS}/snack-fed.png` });
  st = await saved(page);
  expect(st.snacks.small ?? 0).toBe(0);

  // 視窗開著時下面的列表不會被點到；關掉後恢復
  const food = t.food;
  await tap(page, t.feed!.close);
  await page.waitForFunction(() => window.__WGZ__?.training?.feed === null);
  expect((await wgz(page)).training!.food).toBe(food);
});

test('第一次打倒頭目：訊息很多時結算面板排得下', async ({ page }) => {
  await openLobby(page, '?fast=1&seed=7&limits=0');
  const strong = { level: 30, exp: 0, growthAttack: 150, growthDefense: 150 };
  await patchSave(page, {
    cleared: ['luoyepo-1', 'luoyepo-2', 'luoyepo-3', 'luoyepo-4'],
    dogs: Object.fromEntries(ALL.map((id) => [id, strong])),
    settings: { skipBattle: true },
  });
  await tap(page, (await wgz(page)).lobby!.buttons.expedition);
  await battleFromMap(page, 4);
  await page.waitForFunction(() => !!window.__WGZ__?.result);
  const s = await wgz(page);
  expect(s.result!.win).toBe(true);
  expect(s.drop).toBeTruthy();
  expect((await saved(page)).snacks).toEqual({ small: 3 });
  expect(s.nextButton!.y + s.nextButton!.height).toBeLessThanOrEqual(390);
  await page.screenshot({ path: `${SHOTS}/snack-boss-result.png` });
});
