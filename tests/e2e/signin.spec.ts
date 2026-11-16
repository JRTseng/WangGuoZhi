import { expect, test, type Page } from '@playwright/test';
import { openLobby, patchSave, tap, waitScene, wgz } from './helpers';

const W = 844;
const H = 390;
const SHOTS = 'artifacts/screenshots/T026';
const signin = async (page: Page) => (await wgz(page)).signin!;
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(window.localStorage.getItem('wgz-save')!).state);

async function openSignin(page: Page) {
  await tap(page, (await wgz(page)).lobby!.buttons.reward);
  await waitScene(page, 'SigninScene');
}

test('七日簽到：主頁「獎勵」亮紅點，進去領今天的，一天一次，重開還在', async ({ page }) => {
  await openLobby(page, '?fast=1');
  // 新遊戲今天還沒簽：主頁「獎勵」亮紅點
  await page.waitForFunction(() => window.__WGZ__?.lobby?.signinReady === true);
  await page.screenshot({ path: `${SHOTS}/signin-lobby-dot.png` });
  await openSignin(page);

  let s = await signin(page);
  expect(s).toMatchObject({ ready: true, index: 0, total: 0 });
  expect(s.cells).toHaveLength(7);
  expect(s.cells.map((c) => c.status)).toEqual([
    'today',
    'later',
    'later',
    'later',
    'later',
    'later',
    'later',
  ]);
  expect(s.cells[0]).toMatchObject({ day: 1, food: 300, bones: 0, snack: null });
  expect(s.cells[6]).toMatchObject({ day: 7, food: 1000, bones: 100 });
  expect(s.cells[6].snack).toEqual({ id: 'small', amount: 5 });
  for (const c of s.cells) {
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.x + c.width).toBeLessThanOrEqual(W);
    expect(c.y + c.height).toBeLessThanOrEqual(s.claim.y);
  }
  expect(s.claim.height).toBeGreaterThanOrEqual(44);
  expect(s.claim.y + s.claim.height).toBeLessThanOrEqual(H);
  await page.screenshot({ path: `${SHOTS}/signin-day1.png` });

  // 領第 1 天：糧草 +300
  const before = (await wgz(page)).resources!;
  await tap(page, s.claim);
  await page.waitForFunction(() => window.__WGZ__?.signin?.ready === false);
  s = await signin(page);
  expect(s).toMatchObject({ ready: false, index: 0, total: 1 });
  expect(s.cells[0].status).toBe('claimed');
  expect(s.cells[1].status).toBe('later');
  expect((await wgz(page)).resources).toEqual({ food: before.food + 300, bones: before.bones });
  await page.screenshot({ path: `${SHOTS}/signin-day1-claimed.png` });

  // 今天領過了，再按沒有用
  await tap(page, s.claim);
  await page.waitForTimeout(300);
  expect((await signin(page)).total).toBe(1);
  expect((await wgz(page)).resources).toEqual({ food: before.food + 300, bones: before.bones });

  // 回主頁紅點熄掉；重開還是領過
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  await page.waitForFunction(() => window.__WGZ__?.lobby?.signinReady === false);
  await page.reload();
  await waitScene(page, 'LobbyScene');
  await page.waitForFunction(() => window.__WGZ__?.lobby?.signinReady === false);
  expect((await saved(page)).signin.count).toBe(1);
});

test('七日簽到：第 7 天領大獎（糧草、骨頭幣、零食），當天七格全勾', async ({ page }) => {
  await openLobby(page, '?fast=1');
  // 之前簽過 6 天，上次是很久以前（漏簽不歸零）；已經打完第 1 章，糧草加倍
  await patchSave(page, {
    signin: { day: '2026-01-01', count: 6 },
    cleared: ['luoyepo-1', 'luoyepo-2', 'luoyepo-3', 'luoyepo-4', 'luoyepo-5'],
  });
  await page.waitForFunction(() => window.__WGZ__?.lobby?.signinReady === true);
  await openSignin(page);
  let s = await signin(page);
  expect(s).toMatchObject({ ready: true, index: 6, total: 6 });
  expect(s.cells.map((c) => c.status)).toEqual([
    'claimed',
    'claimed',
    'claimed',
    'claimed',
    'claimed',
    'claimed',
    'today',
  ]);
  expect(s.cells[6]).toMatchObject({ food: 2000, bones: 100 });
  await page.screenshot({ path: `${SHOTS}/signin-day7.png` });

  const before = (await wgz(page)).resources!;
  const snacksBefore = (await saved(page)).snacks.small ?? 0;
  await tap(page, s.claim);
  await page.waitForFunction(() => window.__WGZ__?.signin?.ready === false);
  s = await signin(page);
  expect(s.total).toBe(7);
  expect(s.cells.every((c) => c.status === 'claimed')).toBe(true);
  expect((await wgz(page)).resources).toEqual({
    food: before.food + 2000,
    bones: before.bones + 100,
  });
  expect((await saved(page)).snacks.small).toBe(snacksBefore + 5);
  await page.screenshot({ path: `${SHOTS}/signin-day7-claimed.png` });
});
