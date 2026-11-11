import { expect, test, type Page } from '@playwright/test';
import { openLobby, sendAndWait, tap, waitScene, wgz, type R } from './helpers';

const battle = async (page: Page) => (await wgz(page)).battle!;

test('戰鬥畫面：速度 ×1～×4 切換並記住，略過直接到結算（勝利）', async ({ page }) => {
  // &battle=slow：出征時間用測試模式，戰鬥畫面放慢 4 倍，機器再慢也來得及按按鈕
  await openLobby(page, '?fast=1&battle=slow');
  await sendAndWait(page);
  await tap(page, (await wgz(page)).status!);
  await waitScene(page, 'BattleScene');

  let b = await battle(page);
  expect(b).toMatchObject({ stageId: 'luoyepo-1', phase: 'playing', speed: 1, skipped: false });
  expect(b.team.map((u) => u.id)).toEqual(['daer', 'heixuan', 'changxu']);
  expect(b.enemies).toHaveLength(3);
  expect((await wgz(page)).result ?? null).toBeNull();
  // 放慢 4 倍後還在 40 秒內，也就是正常 1 倍速整場 10 秒內
  expect(b.stepMs * b.total).toBeLessThanOrEqual(40_000);

  // 速度按鈕：×1 → ×2 → ×3 → ×4 → ×1，每次出手的時間跟著縮短
  // （一進場就先測完切回 ×1，免得機器慢的時候戰鬥先播完）
  const steps = [b.stepMs];
  for (const speed of [2, 3, 4]) {
    await tap(page, b.speedButton);
    await page.waitForFunction((s) => window.__WGZ__?.battle?.speed === s, speed);
    steps.push((await battle(page)).stepMs);
  }
  for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeLessThan(steps[i - 1]);
  await tap(page, b.speedButton);
  await page.waitForFunction(() => window.__WGZ__?.battle?.speed === 1);

  // 播了幾下：有人被扣血
  await page.waitForFunction(() => (window.__WGZ__?.battle?.index ?? 0) >= 3);
  b = await battle(page);
  expect([...b.team, ...b.enemies].some((u) => u.hp < u.maxHp)).toBe(true);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/battle.png' });
  // 停在 ×2，等一下檢查有沒有被記住
  await tap(page, b.speedButton);
  await page.waitForFunction(() => window.__WGZ__?.battle?.speed === 2);

  // 略過 → 直接結算；結果和收成時算好的一樣（勝）
  b = await battle(page);
  expect(b.phase, '戰鬥還沒播完才能測略過').toBe('playing');
  expect(b.index).toBeLessThan(b.total);
  await tap(page, b.skipButton);
  await page.waitForFunction(() => window.__WGZ__?.battle?.phase === 'result');
  b = await battle(page);
  expect(b).toMatchObject({ win: true, skipped: true });
  expect(b.index).toBe(b.total);
  expect(b.enemies.every((u) => u.hp === 0)).toBe(true);
  expect(b.team.some((u) => u.hp > 0)).toBe(true);
  expect((await wgz(page)).result).toEqual({ food: 120, bones: 5, win: true });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/battle-win.png' });

  // 關掉結算 → 過關劇情 → 主頁；倍速有被記住
  await tap(page, { x: 0, y: 800, width: 390, height: 20 });
  await waitScene(page, 'StoryScene');
  await tap(page, (await wgz(page)).story!.skip!);
  await waitScene(page, 'LobbyScene');
  const s = await wgz(page);
  expect(s.resources).toEqual({ food: 1320, bones: 55 });
  await tap(page, s.lobby!.buttons.account);
  await page.waitForFunction(() => !!window.__WGZ__?.settings);
  expect((await wgz(page)).settings!.values.battleSpeed).toBe(2);
});

test('打輸：播完顯示敗北，只拿三成獎勵，關卡沒通過', async ({ page }) => {
  await openLobby(page, '?fast=1');
  // 只派阿白（戰力 70）去建議戰力 150 的關卡，一定輸
  await sendAndWait(page, 0, ['abai']);
  await tap(page, (await wgz(page)).status!);
  await waitScene(page, 'BattleScene');
  await page.waitForFunction(() => window.__WGZ__?.battle?.phase === 'result');
  const b = await battle(page);
  expect(b).toMatchObject({ win: false, skipped: false });
  expect(b.team.map((u) => u.hp)).toEqual([0]);
  expect(b.enemies.some((u) => u.hp > 0)).toBe(true);
  expect((await wgz(page)).result).toEqual({ food: 36, bones: 1, win: false });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/battle-lose.png' });

  // 沒有過關劇情，直接回主頁；狗狗回家、關卡還是沒通過
  await tap(page, { x: 0, y: 800, width: 390, height: 20 });
  await waitScene(page, 'LobbyScene');
  const s = await wgz(page);
  expect(s.resources).toEqual({ food: 1236, bones: 51 });
  expect(s.expedition).toBeNull();
  await tap(page, s.lobby!.buttons.expedition);
  await waitScene(page, 'CampaignScene');
  expect((await wgz(page)).map!.nodes.map((n) => n.state)).toEqual([
    'open',
    'locked',
    'locked',
    'locked',
    'locked',
  ]);
});

test('設定打開「略過戰鬥畫面」：收成直接顯示結算，不進戰鬥畫面', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await tap(page, (await wgz(page)).lobby!.buttons.account);
  await page.waitForFunction(() => !!window.__WGZ__?.settings);
  let st = (await wgz(page)).settings!;
  expect(st.values.skipBattle).toBe(false);
  await tap(page, st.rects.skipBattle);
  await page.waitForFunction(() => window.__WGZ__?.settings?.values.skipBattle === true);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/settings-skip-battle.png' });
  st = (await wgz(page)).settings!;
  await tap(page, st.rects.close);
  await page.waitForFunction(() => !window.__WGZ__?.settings);

  await sendAndWait(page);
  await tap(page, (await wgz(page)).status!);
  await page.waitForFunction(() => !!window.__WGZ__?.result);
  const s = await wgz(page);
  expect(s.scene).toBe('LobbyScene');
  expect(s.battle).toBeUndefined();
  expect(s.result).toEqual({ food: 120, bones: 5, win: true });
  expect(s.resources).toEqual({ food: 1320, bones: 55 });
  await page.screenshot({ path: 'artifacts/screenshots/portrait/harvest-skip.png' });
});

test.describe('手機橫放', () => {
  const W = 844;
  const H = 390;
  test.use({ viewport: { width: W, height: H } });

  test('戰鬥畫面橫式：5 隻全上，都在畫面內', async ({ page }) => {
    await openLobby(page, '?fast=1&battle=slow');
    await sendAndWait(page, 0, ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai']);
    await tap(page, (await wgz(page)).status!);
    await waitScene(page, 'BattleScene');
    let b = await battle(page);
    expect(b.team).toHaveLength(5);
    const inside = (r: R) => {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(W);
      expect(r.y + r.height).toBeLessThanOrEqual(H);
    };
    inside(b.skipButton);
    inside(b.speedButton);
    for (const u of [...b.team, ...b.enemies]) {
      inside({ x: u.x - u.r, y: u.y - u.r, width: u.r * 2, height: u.r * 2 });
    }
    await page.waitForFunction(() => (window.__WGZ__?.battle?.index ?? 0) >= 4);
    await page.screenshot({ path: 'artifacts/screenshots/landscape/battle.png' });

    // 直接放到 ×4 看完整場，不略過
    for (const speed of [2, 3, 4]) {
      await tap(page, b.speedButton);
      await page.waitForFunction((s) => window.__WGZ__?.battle?.speed === s, speed);
    }
    await page.waitForFunction(() => window.__WGZ__?.battle?.phase === 'result', null, {
      timeout: 30_000,
    });
    b = await battle(page);
    expect(b).toMatchObject({ win: true, skipped: false });
    expect((await wgz(page)).result).toEqual({ food: 120, bones: 5, win: true });
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'artifacts/screenshots/landscape/battle-win.png' });
  });
});
