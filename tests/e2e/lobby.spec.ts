import { expect, test } from '@playwright/test';
import { openLobby, tap, wgz } from './helpers';

test('主頁：左上帳號、左側選單、右上資源與小圖示、下方大卡片，狗狗會換動作', async ({ page }) => {
  await openLobby(page);
  const s = await wgz(page);
  expect(s.orientation).toBe('portrait');
  expect(s.resources).toEqual({ food: 1200, bones: 50 });
  expect(s.lobby!.dogId).toBe('daer');
  expect(s.lobby!.background).toBe('slope');

  const b = s.lobby!.buttons;
  expect(b.account.x).toBeLessThan(40);
  expect(b.account.y).toBeLessThan(40);
  // 左側選單由上而下：武將、任務、倉庫、背景
  const menu = [b.team, b.quest, b.bag, b.background];
  for (const r of menu) expect(r.x + r.width).toBeLessThan(390 / 2);
  for (let i = 1; i < menu.length; i++) expect(menu[i].y).toBeGreaterThan(menu[i - 1].y);
  // 右上：召募／商城／獎勵／信箱
  for (const r of [b.recruit, b.shop, b.reward, b.mail]) {
    expect(r.x + r.width).toBeLessThanOrEqual(390);
    expect(r.y).toBeLessThan(200);
  }
  // 下方：劇情與小卡在上、出征大卡在最下面（拇指好按）
  expect(b.story.y).toBeGreaterThan(844 / 2);
  expect(b.expedition.y).toBeGreaterThan(b.story.y);
  expect(s.status!.y).toBeGreaterThan(b.expedition.y);

  // 還沒做的功能點了顯示「即將開放」，不會換畫面
  await tap(page, b.quest);
  await page.waitForTimeout(200);
  expect((await wgz(page)).scene).toBe('LobbyScene');
  expect(s.status!.label).toContain('待命');

  // 狗狗每幾秒換一個動作
  const first = s.lobby!.dogAction;
  await page.waitForFunction((a) => window.__WGZ__?.lobby?.dogAction !== a, first, {
    timeout: 8000,
  });
  await page.screenshot({ path: 'artifacts/screenshots/portrait/lobby.png' });
});

test('帳號與設定：開關、畫質、優惠碼', async ({ page }) => {
  await openLobby(page);
  await tap(page, (await wgz(page)).lobby!.buttons.account);
  await page.waitForFunction(() => !!window.__WGZ__?.settings);
  let st = (await wgz(page)).settings!;
  expect(st.values).toEqual({
    voice: true,
    music: true,
    push: false,
    quality: 'high',
    skipBattle: false,
    battleSpeed: 1,
  });
  for (const k of [
    'voice',
    'music',
    'push',
    'low',
    'medium',
    'high',
    'site',
    'forum',
    'redeem',
    'close',
  ])
    expect(st.rects[k], k).toBeTruthy();

  await tap(page, st.rects.music);
  await page.waitForFunction(() => window.__WGZ__?.settings?.values.music === false);
  await tap(page, st.rects.low);
  await page.waitForFunction(() => window.__WGZ__?.settings?.values.quality === 'low');

  // 錯誤的碼
  const input = page.locator('input[aria-label="優惠碼"]');
  await input.fill('nope');
  await tap(page, st.rects.redeem);
  await page.waitForFunction(() => window.__WGZ__?.settings?.message === '找不到這組優惠碼');

  // 活動碼：骨頭幣 +100、解鎖燈會背景
  await input.fill('wangwang');
  await tap(page, st.rects.redeem);
  await page.waitForFunction(() => window.__WGZ__?.resources?.bones === 150);
  st = (await wgz(page)).settings!;
  expect(st.message).toContain('兌換成功');
  await page.screenshot({ path: 'artifacts/screenshots/portrait/settings.png' });

  await tap(page, st.rects.close);
  await page.waitForFunction(() => window.__WGZ__?.settings === undefined);

  // 換背景：落葉坡 → 燈會（活動）→ 落葉坡
  const bg = (await wgz(page)).lobby!.buttons.background;
  await tap(page, bg);
  await page.waitForFunction(() => window.__WGZ__?.lobby?.background === 'lantern');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/lobby-lantern.png' });
  await tap(page, bg);
  await page.waitForFunction(() => window.__WGZ__?.lobby?.background === 'slope');
});
