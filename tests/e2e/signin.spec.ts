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
  // 第 7 天是自選 SSR 碎片，還沒選
  expect(s.cells[6]).toMatchObject({ day: 7, food: 0, bones: 0, snack: null });
  expect(s.cells[6].shards).toEqual({ dogId: '', amount: 15 });
  expect(s.cells[6].text).toBe('SSR 碎片 ×15');
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
  expect(s).toMatchObject({ ready: false, index: 0, total: 1, streak: 1 });
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

/** 幾天前的遊戲日（當地 05:00 換日），和遊戲裡算的一樣 */
const dayAgo = (page: Page, days: number) =>
  page.evaluate((n) => {
    const now = Date.now();
    const t = now - new Date(now).getTimezoneOffset() * 60_000 - 5 * 3_600_000 - n * 86_400_000;
    return new Date(t).toISOString().slice(0, 10);
  }, days);

test('七日簽到：第 7 天送自選 SSR 碎片，沒選先跳出來選，選完直接領', async ({ page }) => {
  await openLobby(page, '?fast=1');
  // 已經連續簽了 6 天，昨天是第 6 天
  await patchSave(page, {
    signin: { day: await dayAgo(page, 1), count: 6, streak: 6, pick: '', shown: '' },
  });
  await page.waitForFunction(() => window.__WGZ__?.lobby?.signinReady === true);
  await openSignin(page);
  let s = await signin(page);
  expect(s).toMatchObject({ ready: true, index: 6, total: 6, streak: 6, broken: false, pick: '' });
  expect(s.cells.map((c) => c.status)).toEqual([
    'claimed',
    'claimed',
    'claimed',
    'claimed',
    'claimed',
    'claimed',
    'today',
  ]);
  await page.screenshot({ path: `${SHOTS}/signin-day7.png` });

  // 點第 7 天那張卡：跳出所有 SSR 狗給你選，全部在畫面內
  await tap(page, s.cells[6]);
  await page.waitForFunction(() => !!window.__WGZ__?.signin?.picker);
  let picker = (await signin(page)).picker!;
  expect(picker.cells.length).toBeGreaterThanOrEqual(2);
  for (const c of picker.cells) {
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.x + c.width).toBeLessThanOrEqual(W);
    expect(c.y).toBeGreaterThanOrEqual(0);
    expect(c.y + c.height).toBeLessThanOrEqual(H);
    expect(Math.min(c.width, c.height)).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: `${SHOTS}/signin-pick.png` });
  // 先選第一隻：只是設定，還沒領
  await tap(page, picker.cells[0]);
  await page.waitForFunction(() => window.__WGZ__?.signin?.picker === null);
  s = await signin(page);
  expect(s).toMatchObject({ ready: true, pick: picker.cells[0].id });
  expect(s.cells[6].shards).toEqual({ dogId: picker.cells[0].id, amount: 15 });
  expect(s.cells[6].text).toBe(`${picker.cells[0].name}碎片 ×15`);

  // 再點一次換成第二隻；關掉重開遊戲還記得
  await tap(page, s.cells[6]);
  await page.waitForFunction(() => !!window.__WGZ__?.signin?.picker);
  picker = (await signin(page)).picker!;
  expect(picker.cells[0].picked).toBe(true);
  const dog = picker.cells[1];
  await tap(page, dog);
  await page.waitForFunction((id) => window.__WGZ__?.signin?.pick === id, dog.id);
  expect((await saved(page)).signin.pick).toBe(dog.id);
  await page.screenshot({ path: `${SHOTS}/signin-day7-picked.png` });

  // 領：那隻狗的碎片 +15，七格全勾
  const before = (await saved(page)).shards[dog.id] ?? 0;
  await tap(page, (await signin(page)).claim);
  await page.waitForFunction(() => window.__WGZ__?.signin?.ready === false);
  s = await signin(page);
  expect(s).toMatchObject({ total: 7, streak: 7 });
  expect(s.cells.every((c) => c.status === 'claimed')).toBe(true);
  expect((await saved(page)).shards[dog.id]).toBe(before + 15);
  await page.screenshot({ path: `${SHOTS}/signin-day7-claimed.png` });
});

test('七日簽到：第 7 天沒選狗就按領取，選完直接領到', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await patchSave(page, {
    signin: { day: await dayAgo(page, 1), count: 6, streak: 6, pick: '', shown: '' },
  });
  await openSignin(page);
  await tap(page, (await signin(page)).claim);
  await page.waitForFunction(() => !!window.__WGZ__?.signin?.picker);
  // 還沒選之前沒有領到
  expect((await signin(page)).ready).toBe(true);
  const dog = (await signin(page)).picker!.cells[0];
  const before = (await saved(page)).shards[dog.id] ?? 0;
  await tap(page, dog);
  await page.waitForFunction(() => window.__WGZ__?.signin?.ready === false);
  expect((await saved(page)).shards[dog.id]).toBe(before + 15);
  expect((await saved(page)).signin).toMatchObject({ count: 7, streak: 7, pick: dog.id });
});

test('七日簽到：要連續簽，漏了一天就從第 1 天重新開始', async ({ page }) => {
  await openLobby(page, '?fast=1');
  // 簽到第 4 天以後兩天沒來
  await patchSave(page, {
    signin: { day: await dayAgo(page, 2), count: 4, streak: 4, pick: '', shown: '' },
  });
  await openSignin(page);
  let s = await signin(page);
  expect(s).toMatchObject({ ready: true, index: 0, total: 4, streak: 0, broken: true });
  expect(s.cells.map((c) => c.status)).toEqual([
    'today',
    'later',
    'later',
    'later',
    'later',
    'later',
    'later',
  ]);
  await page.screenshot({ path: `${SHOTS}/signin-broken.png` });
  const before = (await wgz(page)).resources!;
  await tap(page, s.claim);
  await page.waitForFunction(() => window.__WGZ__?.signin?.ready === false);
  s = await signin(page);
  expect(s).toMatchObject({ index: 0, total: 5, streak: 1, broken: false });
  expect((await wgz(page)).resources!.food).toBe(before.food + 300);
});

test('七日簽到：每天第一次進主頁自動跳出，回主頁不會再跳', async ({ page }) => {
  await page.goto('/?fast=1&limits=1&signin=1&faction=0');
  // 今天還沒簽：一進主頁就被帶到簽到畫面
  await waitScene(page, 'SigninScene');
  expect(await signin(page)).toMatchObject({ ready: true, index: 0 });
  // 不簽直接回主頁：留在主頁，紅點還亮著
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  await page.waitForFunction(() => window.__WGZ__?.lobby?.signinReady === true);
  await page.waitForTimeout(600);
  expect((await wgz(page)).scene).toBe('LobbyScene');
  // 今天重開遊戲也不會再跳
  await page.reload();
  await waitScene(page, 'LobbyScene');
  await page.waitForTimeout(600);
  expect((await wgz(page)).scene).toBe('LobbyScene');
  // 換日（把「跳過的那天」改回昨天）又會跳
  await page.evaluate(
    (day) => {
      const file = JSON.parse(localStorage.getItem('wgz-save')!);
      file.state.signin.shown = day;
      localStorage.setItem('wgz-save', JSON.stringify(file));
    },
    await dayAgo(page, 1),
  );
  await page.reload();
  await waitScene(page, 'SigninScene');
});
