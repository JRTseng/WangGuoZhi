import { expect, test } from '@playwright/test';
import { openLobby, patchSave, startBattle, tap, waitScene, wgz } from './helpers';

const SHOTS = 'artifacts/screenshots/landscape';

test('受傷外觀：打輸後出戰的狗掛彩，回主頁舔傷口；能力不變', async ({ page }) => {
  await openLobby(page, '?fast=1');
  expect((await wgz(page)).lobby!.dogHurt).toBe(0);
  // 讓阿白當主頁角色，自己去打第 1 關（打不贏）
  await patchSave(page, { lobbyDogId: 'abai' });
  await startBattle(page, 0, ['abai']);
  await waitScene(page, 'BattleScene');
  await page.waitForFunction(() => window.__WGZ__?.battle?.phase === 'result');
  expect((await wgz(page)).result!.win).toBe(false);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/wounds-defeat.png` });

  // 關掉結算回主頁：阿白掛彩（OK 繃＋頭套），第一個動作是舔傷口
  await tap(page, { x: 0, y: 380, width: 844, height: 6 });
  await waitScene(page, 'CampaignScene');
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  const lobby = (await wgz(page)).lobby!;
  expect(lobby).toMatchObject({ dogId: 'abai', dogHurt: 2, dogAction: 'lick' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/wounds-lobby.png` });

  // 組隊畫面的小頭像也看得到；能力照常（等級升了，沒有被扣）
  await tap(page, lobby.buttons.team);
  await waitScene(page, 'TeamScene');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/wounds-team.png` });
});

test('受傷外觀：時間到了自己恢復', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await patchSave(page, { wounds: { daer: { level: 1, until: Date.now() + 15000 } } });
  expect((await wgz(page)).lobby!.dogHurt).toBe(1);
  await page.waitForFunction(() => window.__WGZ__?.lobby?.dogHurt === 0, null, { timeout: 40000 });
  expect((await wgz(page)).lobby!.dogAction).toBe('idle');
});
