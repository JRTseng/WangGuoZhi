import { expect, test } from '@playwright/test';
import { openLobby, tap, wgz } from './helpers';

test('主頁：左上帳號、右上資源、右側劇情／組隊／出征，狗狗會換動作', async ({ page }) => {
  await openLobby(page);
  const s = await wgz(page);
  expect(s.orientation).toBe('portrait');
  expect(s.resources).toEqual({ food: 1200, bones: 50 });
  expect(s.lobby!.dogId).toBe('daer');
  expect(s.lobby!.background).toBe('slope');

  const { account, story, team, expedition } = s.lobby!.buttons;
  expect(account.x).toBeLessThan(40);
  expect(account.y).toBeLessThan(40);
  for (const b of [story, team, expedition]) {
    expect(b.x).toBeGreaterThan(390 / 2);
    expect(b.x + b.width).toBeLessThanOrEqual(390);
  }
  expect(team.y).toBeGreaterThan(story.y);
  expect(expedition.y).toBeGreaterThan(team.y);
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
  expect(st.values).toEqual({ voice: true, music: true, push: false, quality: 'high' });
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
