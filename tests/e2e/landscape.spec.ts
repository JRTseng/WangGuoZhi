import { expect, test } from '@playwright/test';
import { openLobby, tap, waitScene, wgz, type R } from './helpers';

const W = 844;
const H = 390;
const inside = (r: R) => {
  expect(r.x).toBeGreaterThanOrEqual(0);
  expect(r.y).toBeGreaterThanOrEqual(0);
  expect(r.x + r.width).toBeLessThanOrEqual(W);
  expect(r.y + r.height).toBeLessThanOrEqual(H);
};

test.describe('手機橫放', () => {
  test.use({ viewport: { width: W, height: H } });

  test('各畫面切成橫式版面', async ({ page }) => {
    await openLobby(page, '?fast=1');
    let s = await wgz(page);
    expect(s.orientation).toBe('landscape');
    expect(s.size).toEqual({ width: W, height: H });
    for (const r of Object.values(s.lobby!.buttons)) inside(r);
    inside(s.status!);
    inside(s.auto!.toggle);
    const box = await page.locator('canvas').boundingBox();
    expect(box!.width).toBeCloseTo(W, 0);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'artifacts/screenshots/landscape/lobby.png' });

    await tap(page, s.lobby!.buttons.account);
    await page.waitForFunction(() => !!window.__WGZ__?.settings);
    for (const r of Object.values((await wgz(page)).settings!.rects)) inside(r);
    await page.screenshot({ path: 'artifacts/screenshots/landscape/settings.png' });
    await tap(page, (await wgz(page)).settings!.rects.close);

    await tap(page, s.lobby!.buttons.team);
    await waitScene(page, 'TeamScene');
    // T007 起狗變多，卡片格要捲動：只看目前看得到的
    for (const d of (await wgz(page)).team!.dogs.filter((c) => c.visible)) inside(d);
    for (const slot of (await wgz(page)).team!.slots) inside(slot);
    expect((await wgz(page)).team!.slots).toHaveLength(5);
    await page.screenshot({ path: 'artifacts/screenshots/landscape/team.png' });
    await tap(page, (await wgz(page)).backButton!);
    await waitScene(page, 'LobbyScene');

    await tap(page, (await wgz(page)).lobby!.buttons.expedition);
    await waitScene(page, 'CampaignScene');
    const m = (await wgz(page)).map!;
    for (const n of m.nodes) inside(n);
    // 橫式由左往右走
    for (let i = 1; i < m.nodes.length; i++) expect(m.nodes[i].x).toBeGreaterThan(m.nodes[i - 1].x);
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'artifacts/screenshots/landscape/map.png' });

    await tap(page, m.nodes[0]);
    await page.waitForFunction(() => !!window.__WGZ__?.map?.stagePanel);
    await tap(page, (await wgz(page)).map!.stagePanel!.go);
    await waitScene(page, 'ExpeditionScene');
    const e = (await wgz(page)).expeditionPanel!;
    for (const c of e.teamCards) inside(c);
    inside(e.confirmButton!);
    await page.screenshot({ path: 'artifacts/screenshots/landscape/team-pick.png' });
    // 開戰直接進戰鬥畫面 → 略過 → 結算 → 過關劇情 → 主頁
    await tap(page, e.confirmButton!);
    await waitScene(page, 'BattleScene');
    await tap(page, (await wgz(page)).battle!.skipButton);
    await page.waitForFunction(() => !!window.__WGZ__?.result);
    await tap(page, { x: 0, y: 380, width: W, height: 6 });
    await waitScene(page, 'StoryScene');
    await tap(page, (await wgz(page)).story!.skip!);
    await waitScene(page, 'LobbyScene');
    s = await wgz(page);
    // 測試模式體力 5 秒回 1 點，留一點誤差
    expect(s.stamina!.value).toBeGreaterThanOrEqual(80);
    expect(s.stamina!.value).toBeLessThan(90);
    inside(s.auto!.toggle);

    await tap(page, s.lobby!.buttons.story);
    await waitScene(page, 'StoryScene');
    await tap(page, (await wgz(page)).story!.items[0]);
    await page.waitForFunction(() => window.__WGZ__?.story?.mode === 'play');
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'artifacts/screenshots/landscape/story.png' });
  });
});

test('固定橫向：直拿手機時整個畫面自動轉成橫的，不用提示也不用關直向鎖定，照樣點得到', async ({
  page,
}) => {
  await openLobby(page);
  expect((await wgz(page)).orientation).toBe('landscape');
  const html = page.locator('html');
  await expect(html).not.toHaveClass(/wgz-rotated/);

  // 直拿：畫面轉 90 度佔滿整個螢幕（手機頂端是遊戲的左邊），遊戲還是橫式尺寸
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(html).toHaveClass(/wgz-rotated/);
  await page.waitForTimeout(800);
  await expect(page.locator('#rotate')).toHaveCount(0);
  const turned = await page.locator('canvas').boundingBox();
  expect(turned!.width).toBeCloseTo(H, 0);
  expect(turned!.height).toBeCloseTo(W, 0);
  let s = await wgz(page);
  expect(s.scene).toBe('LobbyScene');
  expect(s.orientation).toBe('landscape');
  expect(s.size).toEqual({ width: W, height: H });
  // 轉過來以後按鈕照樣點得到：遊戲裡的 (x, y) 在螢幕上的 (390 - y, x)
  const team = s.lobby!.buttons.team;
  await page.touchscreen.tap(H - (team.y + team.height / 2), team.x + team.width / 2);
  await waitScene(page, 'TeamScene');
  await page.screenshot({ path: 'artifacts/screenshots/landscape/rotated-portrait.png' });

  // 橫放回來：不再轉，畫布填滿畫面
  await page.setViewportSize({ width: W, height: H });
  await expect(html).not.toHaveClass(/wgz-rotated/);
  await page.waitForTimeout(800);
  s = await wgz(page);
  expect(s.scene).toBe('TeamScene');
  expect(s.team!.slots.map((x) => x.id)).toEqual(['daer', 'heixuan', 'changxu', null, null]);
  const box = await page.locator('canvas').boundingBox();
  expect(box!.width).toBeCloseTo(W, 0);
  expect(box!.height).toBeCloseTo(H, 0);
});
