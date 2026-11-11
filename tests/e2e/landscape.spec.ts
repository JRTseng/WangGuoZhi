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
    for (const d of (await wgz(page)).team!.dogs) inside(d);
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
    await tap(page, e.confirmButton!);
    await waitScene(page, 'LobbyScene');
    s = await wgz(page);
    expect(s.expedition).toBeTruthy();

    await tap(page, s.lobby!.buttons.story);
    await waitScene(page, 'StoryScene');
    await tap(page, (await wgz(page)).story!.items[0]);
    await page.waitForFunction(() => window.__WGZ__?.story?.mode === 'play');
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'artifacts/screenshots/landscape/story.png' });
  });
});

test('直放轉橫放：畫面自動重新排版，狀態保留', async ({ page }) => {
  await openLobby(page);
  expect((await wgz(page)).orientation).toBe('portrait');
  await tap(page, (await wgz(page)).lobby!.buttons.team);
  await waitScene(page, 'TeamScene');

  await page.setViewportSize({ width: W, height: H });
  await page.waitForFunction(() => window.__WGZ__?.orientation === 'landscape');
  let s = await wgz(page);
  expect(s.scene).toBe('TeamScene');
  expect(s.size).toEqual({ width: W, height: H });
  expect(s.team!.slots.map((x) => x.id)).toEqual(['daer', 'heixuan', 'changxu']);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.__WGZ__?.orientation === 'portrait');
  s = await wgz(page);
  expect(s.scene).toBe('TeamScene');
  expect(s.size).toEqual({ width: 390, height: 844 });
});
