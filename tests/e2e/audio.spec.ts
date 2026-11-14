import { expect, test } from '@playwright/test';
import { openLobby, startBattle, tap, waitScene, wgz } from './helpers';

const SHOTS = 'artifacts/screenshots/landscape';
const audio = async (page: Parameters<typeof wgz>[0]) => (await wgz(page)).audio!;

test('T016 音樂與音效：第一次操作後才出聲，進戰鬥換曲，設定的開關馬上生效', async ({ page }) => {
  await openLobby(page, '?fast=1');
  // 還沒操作過：知道要播主頁那首，但瀏覽器還不讓出聲
  let a = await audio(page);
  expect(a.wanted).toBe('lobby');
  expect(a.unlocked).toBe(false);
  expect(a.playing).toBeNull();

  // 點一下（開設定）就解鎖，按鈕有點按音效
  await tap(page, (await wgz(page)).lobby!.buttons.account);
  await page.waitForFunction(() => !!window.__WGZ__?.settings);
  await page.waitForFunction(() => window.__WGZ__?.audio?.unlocked === true);
  a = await audio(page);
  expect(a.sfxCount).toBeGreaterThan(0);
  expect(a.lastSfx).toBe('tap');
  // 這台機器的瀏覽器能出聲的話，主頁那首已經開始播
  if (a.running) {
    await page.waitForFunction(() => window.__WGZ__?.audio?.playing === 'lobby');
  }

  // 設定面板有「音樂」「音效」兩個開關，預設都開
  let st = (await wgz(page)).settings!;
  expect(st.values.music).toBe(true);
  expect(st.values.sfx).toBe(true);
  await page.screenshot({ path: `${SHOTS}/audio-settings.png` });

  // 關掉音樂：馬上停
  await tap(page, st.rects.music);
  await page.waitForFunction(() => window.__WGZ__?.settings?.values.music === false);
  await page.waitForFunction(() => window.__WGZ__?.audio?.playing === null);

  // 關掉音效：之後怎麼點都不算
  await tap(page, (await wgz(page)).settings!.rects.sfx);
  await page.waitForFunction(() => window.__WGZ__?.settings?.values.sfx === false);
  const before = (await audio(page)).sfxCount;
  await tap(page, (await wgz(page)).settings!.rects.push);
  await page.waitForFunction(() => window.__WGZ__?.settings?.values.push === true);
  expect((await audio(page)).sfxCount).toBe(before);

  // 重開遊戲，開關還在
  st = (await wgz(page)).settings!;
  await tap(page, st.rects.close);
  await page.waitForFunction(() => !window.__WGZ__?.settings);
  await page.reload();
  await waitScene(page, 'LobbyScene');
  await tap(page, (await wgz(page)).lobby!.buttons.account);
  await page.waitForFunction(() => !!window.__WGZ__?.settings);
  st = (await wgz(page)).settings!;
  expect(st.values.music).toBe(false);
  expect(st.values.sfx).toBe(false);

  // 都打開，再進戰鬥：換成戰鬥曲，打完有勝利或落敗的音效
  await tap(page, st.rects.music);
  await page.waitForFunction(() => window.__WGZ__?.settings?.values.music === true);
  await tap(page, (await wgz(page)).settings!.rects.sfx);
  await page.waitForFunction(() => window.__WGZ__?.settings?.values.sfx === true);
  if ((await audio(page)).running) {
    await page.waitForFunction(() => window.__WGZ__?.audio?.playing === 'lobby');
  }
  await tap(page, (await wgz(page)).settings!.rects.close);
  await page.waitForFunction(() => !window.__WGZ__?.settings);

  await startBattle(page, 0);
  await waitScene(page, 'BattleScene');
  await page.waitForFunction(() => window.__WGZ__?.audio?.wanted === 'battle');
  if ((await audio(page)).running) {
    await page.waitForFunction(() => window.__WGZ__?.audio?.playing === 'battle');
  }
  await page.waitForFunction(() => !!window.__WGZ__?.result, undefined, { timeout: 60_000 });
  const end = await wgz(page);
  expect(end.audio!.lastSfx).toBe(end.result!.win ? 'win' : 'lose');
});
