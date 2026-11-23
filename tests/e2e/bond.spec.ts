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

const SHOTS = 'artifacts/screenshots/bond';
const ALL = ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'];
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(window.localStorage.getItem('wgz-save')!).state);
const bond = async (page: Page) => (await wgz(page)).lobby!.bond!;

test('好感度：在主頁摸摸主頁角色，一天加一次，升級的禮物直接入袋', async ({ page }) => {
  await openLobby(page, '?fast=1');
  let b = await bond(page);
  expect(b).toMatchObject({ level: 0, points: 0, canPet: true, line: '' });
  expect(b.hit.width).toBeGreaterThanOrEqual(44);
  expect(b.hit.height).toBeGreaterThanOrEqual(44);
  const dogId = (await wgz(page)).lobby!.dogId;
  await page.screenshot({ path: `${SHOTS}/bond-lobby.png` });

  // 摸一下：+10，剛好升到 1 級，送糧草 100
  await tap(page, b.hit);
  await page.waitForFunction(() => window.__WGZ__?.lobby?.bond?.points === 10);
  b = await bond(page);
  expect(b).toMatchObject({ level: 1, canPet: false });
  expect(b.line.length).toBeGreaterThan(0);
  await page.screenshot({ path: `${SHOTS}/bond-pet.png` });
  await expect
    .poll(async () => (await saved(page)).bond.points[dogId], { timeout: 10_000 })
    .toBe(10);
  const st = await saved(page);
  expect(st.bond.petted).toEqual([dogId]);
  const food = st.resources.food;

  // 今天再摸：一樣會撒嬌，但不再加
  await tap(page, b.hit);
  await page.waitForTimeout(300);
  expect((await bond(page)).points).toBe(10);
  expect((await saved(page)).resources.food).toBe(food);

  // 重開遊戲還記得
  await page.reload();
  await waitScene(page, 'LobbyScene');
  expect(await bond(page)).toMatchObject({ level: 1, points: 10, canPet: false });
});

test('好感度：一起出征會增加，升級寫在結算上；角色資料看得到好感度', async ({ page }) => {
  await openLobby(page, '?fast=1&seed=7&limits=0');
  // 五隻都差一點就升 1 級；大耳另外給多一點看資料視窗
  await patchSave(page, {
    bond: {
      points: { daer: 49, heixuan: 9, changxu: 9, xiaosuan: 9, abai: 9 },
      day: '',
      petted: [],
    },
  });
  await enableSkipBattle(page);
  const before = await saved(page);
  await tap(page, (await wgz(page)).lobby!.buttons.expedition);
  await battleFromMap(page, 0, ALL);
  await page.waitForFunction(() => !!window.__WGZ__?.result);
  expect((await wgz(page)).result!.win).toBe(true);
  const st = await saved(page);
  expect(st.bond.points).toEqual({ daer: 52, heixuan: 12, changxu: 12, xiaosuan: 12, abai: 12 });
  // 四隻升到 1 級，各送糧草 100（另外還有這一關本來的獎勵）
  expect(st.resources.food - before.resources.food).toBeGreaterThanOrEqual(400);
  expect(st.history.at(-1).bondUps).toHaveLength(4);
  await page.screenshot({ path: `${SHOTS}/bond-result.png` });
  await tap(page, { x: 2, y: 190, width: 12, height: 12 });
  await waitScene(page, 'StoryScene');
  await tap(page, (await wgz(page)).story!.skip!);
  await waitScene(page, 'LobbyScene');

  // 圖鑑裡看大耳：小故事那一頁多一行好感度
  await tap(page, (await wgz(page)).lobby!.buttons.codex);
  await waitScene(page, 'CodexScene');
  const cell = (await wgz(page)).codex!.cells.find((x) => x.id === 'daer')!;
  await tap(page, cell);
  await page.waitForFunction(() => window.__WGZ__?.codex?.panel === 'daer');
  await page.screenshot({ path: `${SHOTS}/bond-info.png` });
});
