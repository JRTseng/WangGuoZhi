import { expect, test } from '@playwright/test';
import { openLobby, patchSave, startBattle, waitScene, wgz } from './helpers';

const SHOTS = 'artifacts/screenshots/landscape';

test('T025 像素光影：主頁的光線跟著時段換（測試固定白天，網址可以指定）', async ({ page }) => {
  await openLobby(page, '?fast=1');
  expect((await wgz(page)).lobby!.dayTime).toBe('day');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/pixel-lobby-day.png` });

  for (const time of ['dawn', 'dusk', 'night']) {
    await openLobby(page, `?fast=1&time=${time}`);
    expect((await wgz(page)).lobby!.dayTime).toBe(time);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/pixel-lobby-${time}.png` });
  }
});

test('T025 像素光影：本來就是晚上的場景不套時段的色調', async ({ page }) => {
  await openLobby(page, '?fast=1&time=dusk');
  await patchSave(page, { backgroundId: 'lantern', redeemedCodes: ['WANGWANG'] });
  expect((await wgz(page)).lobby!.background).toBe('lantern');
  expect((await wgz(page)).lobby!.dayTime).toBe('dusk');
  expect((await wgz(page)).lobby!.backgroundMoving).toBeGreaterThan(10);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/pixel-lobby-lantern.png` });
});

test('T025 像素光影：戰鬥畫面的場景與頭像也是像素畫風', async ({ page }) => {
  await openLobby(page, '?fast=1&battle=slow');
  await startBattle(page);
  await waitScene(page, 'BattleScene');
  await page.waitForFunction(() => (window.__WGZ__?.battle?.index ?? 0) >= 2);
  await page.screenshot({ path: `${SHOTS}/pixel-battle.png` });
});

test('T025 犬種：主頁的狗照犬種畫（哈士奇）', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await patchSave(page, {
    owned: ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai', 'shuangyan'],
    lobbyDogId: 'shuangyan',
  });
  expect((await wgz(page)).lobby!.dogId).toBe('shuangyan');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/breed-husky.png` });
});
