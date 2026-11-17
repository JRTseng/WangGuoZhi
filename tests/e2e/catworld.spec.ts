import { expect, test } from '@playwright/test';
import { battleFromMap, openLobby, tap, waitScene, wgz } from './helpers';

const SHOTS = 'artifacts/screenshots/catworld';

test('喵國的世界：劇情是找九命鈴那一套，關卡的敵人與頭目是貓', async ({ page }) => {
  await openLobby(page, '?fast=1&battle=normal&faction=cat');

  // 劇情：序章是喵國的
  await tap(page, (await wgz(page)).lobby!.buttons.story);
  await waitScene(page, 'StoryScene');
  const s = (await wgz(page)).story!;
  expect(s.items).toHaveLength(12);
  expect(s.items.map((i) => i.unlocked)).toEqual([
    true,
    ...Array.from({ length: 11 }, () => false),
  ]);
  await tap(page, s.items[0]);
  await page.waitForFunction(() => window.__WGZ__?.story?.playing === 'cat-prologue');
  await tap(page, { x: 100, y: 300, width: 0, height: 0 });
  await page.waitForFunction(() => window.__WGZ__?.story?.line === 1);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/cat-story.png` });
  await tap(page, (await wgz(page)).story!.skip!);
  await page.waitForFunction(() => window.__WGZ__?.story?.mode === 'list');
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');

  // 關卡：第 1 章頭目是石虎葉影，戰鬥裡的敵人是野貓幫
  await tap(page, (await wgz(page)).lobby!.buttons.expedition);
  await waitScene(page, 'CampaignScene');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/cat-map.png` });
  await battleFromMap(page, 0);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/cat-battle.png` });
  const names = await page.evaluate(() => {
    const sc = window.__WGZ_GAME__!.scene.getScene('BattleScene') as unknown as {
      sim: { enemies: { name: string; look?: { breed?: string } }[] };
    };
    return sc.sim.enemies.map((e) => `${e.name}/${e.look?.breed}`);
  });
  expect(names.length).toBeGreaterThan(0);
  for (const n of names) {
    expect(n.startsWith('落葉幫')).toBe(true);
    expect(n.endsWith('貓')).toBe(true);
  }
});

test('喵國的成就說的是貓咪，不是狗狗', async ({ page }) => {
  await openLobby(page, '?fast=1&faction=cat');
  await tap(page, (await wgz(page)).lobby!.buttons.quest);
  await waitScene(page, 'QuestScene');
  await tap(page, (await wgz(page)).quest!.tabs.feat);
  await page.waitForFunction(() =>
    window.__WGZ__?.quest?.rows.some((r) => r.id.startsWith('feat-dogs')),
  );
  const rows = (await wgz(page)).quest!.rows;
  for (const r of rows) expect(r.title).not.toContain('狗');
  expect(rows.find((r) => r.id.startsWith('feat-dogs'))!.title).toContain('貓咪');
  await page.screenshot({ path: `${SHOTS}/cat-feats.png` });
});
