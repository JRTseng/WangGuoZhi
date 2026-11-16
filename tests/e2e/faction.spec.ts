import { expect, test, type Page } from '@playwright/test';
import { openLobby, tap, waitScene, wgz } from './helpers';

const SHOTS = 'artifacts/screenshots/faction';
const CAT_STARTERS = ['juzuo', 'huwen', 'moling', 'xiaoman', 'xuetuan'];
const CATS = 20;
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(window.localStorage.getItem('wgz-save')!).state);

test('選陣營：一開始先選，選喵國手上是五隻貓、召募只抽得到貓，重開還記得', async ({ page }) => {
  // faction=1：照正式的走法，還沒選就先被帶去選陣營畫面
  await page.goto('/?fast=1&limits=1&signin=0&faction=1');
  await waitScene(page, 'FactionScene');
  const f = (await wgz(page)).faction!;
  expect(f).toMatchObject({ current: '', fresh: true });
  // 還沒選的時候沒有返回鍵，兩顆按鈕都在畫面裡、不重疊
  expect((await wgz(page)).backButton).toBeFalsy();
  for (const b of [f.dog, f.cat]) {
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(844);
    expect(b.y + b.height).toBeLessThanOrEqual(390);
    expect(b.height).toBeGreaterThanOrEqual(40);
  }
  expect(f.dog.x + f.dog.width).toBeLessThanOrEqual(f.cat.x);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/faction-pick.png` });

  await tap(page, f.cat);
  await waitScene(page, 'LobbyScene');
  let s = await saved(page);
  expect(s.faction).toBe('cat');
  expect(s.owned).toEqual(CAT_STARTERS);
  expect(s.team).toEqual(CAT_STARTERS.slice(0, 3));
  expect((await wgz(page)).lobby!.dogId).toBe('juzuo');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/faction-cat-lobby.png` });

  // 召募：總數是喵國的 20 隻，十連抽到的全是貓
  await tap(page, (await wgz(page)).lobby!.buttons.recruit);
  await waitScene(page, 'RecruitScene');
  const r = (await wgz(page)).recruit!;
  expect(r).toMatchObject({ owned: 5, total: CATS });
  await tap(page, r.buttons.ten);
  await page.waitForFunction(
    () =>
      (window.__WGZ__?.recruit?.pulls ?? 0) >= 10 && window.__WGZ__?.recruit?.revealing === false,
  );
  await page.screenshot({ path: `${SHOTS}/faction-cat-recruit.png` });
  s = await saved(page);
  const dogs = ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai', 'liuxing', 'nuantong'];
  for (const id of dogs) expect(s.owned).not.toContain(id);
  expect(s.owned.length).toBeGreaterThan(5);

  // 重開：不再問，還是喵國
  await page.reload();
  await waitScene(page, 'LobbyScene');
  expect((await saved(page)).faction).toBe('cat');
});

test('選陣營：主頁的陣營徽章進積分戰、再按換陣營；玩過的存檔換陣營，原本的夥伴留著', async ({
  page,
}) => {
  await openLobby(page, '?fast=1&faction=dog');
  expect((await saved(page)).faction).toBe('dog');
  // 抽一次，存檔就不算「還沒開始玩」
  await tap(page, (await wgz(page)).lobby!.buttons.recruit);
  await waitScene(page, 'RecruitScene');
  await tap(page, (await wgz(page)).recruit!.buttons.one);
  await page.waitForFunction(() => (window.__WGZ__?.recruit?.pulls ?? 0) >= 1);
  const before = await saved(page);

  // 網址不再指定陣營，從徽章進積分戰，右下角換陣營
  await openLobby(page, '?fast=1');
  await tap(page, (await wgz(page)).lobby!.buttons.faction);
  await waitScene(page, 'WarScene');
  await tap(page, (await wgz(page)).war!.switch);
  await waitScene(page, 'FactionScene');
  const f = (await wgz(page)).faction!;
  expect(f).toMatchObject({ current: 'dog', fresh: false });
  expect((await wgz(page)).backButton).toBeTruthy();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/faction-switch.png` });
  await tap(page, f.cat);
  await waitScene(page, 'LobbyScene');
  const after = await saved(page);
  expect(after.faction).toBe('cat');
  expect(after.owned).toEqual([...before.owned, ...CAT_STARTERS]);
  expect(after.team).toEqual(before.team);
});
