import { expect, test } from '@playwright/test';
import { openLobby, tap, waitScene, wgz } from './helpers';

test('出征地圖 → 選隊伍 → 倒數 → 收成 → 劇情 → 下一關開放（測試模式）', async ({ page }) => {
  // 完整流程含 5 秒倒數與多次換畫面，給比預設 30 秒寬的時間
  test.setTimeout(60_000);
  await openLobby(page, '?fast=1');
  await tap(page, (await wgz(page)).lobby!.buttons.expedition);
  await waitScene(page, 'CampaignScene');

  // 1. 三章，只有第一章開放；5 個節點，最後一個是 Boss
  let m = (await wgz(page)).map!;
  expect(m.chapters.map((c) => c.unlocked)).toEqual([true, false, false]);
  expect(m.nodes.map((n) => n.state)).toEqual(['open', 'locked', 'locked', 'locked', 'locked']);
  expect(m.nodes.map((n) => n.boss)).toEqual([false, false, false, false, true]);
  expect(m.nodes[4].width).toBeGreaterThan(m.nodes[0].width);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/map.png' });

  // 鎖住的章節、關卡點了不會動
  await tap(page, m.chapters[1]);
  await tap(page, m.nodes[1]);
  m = (await wgz(page)).map!;
  expect(m.chapter).toBe(0);
  expect(m.stagePanel).toBeNull();

  // 2. 點第 1 關 → 關卡詳情 → 選隊伍出發
  await tap(page, m.nodes[0]);
  await page.waitForFunction(() => window.__WGZ__?.map?.stagePanel?.stageId === 'luoyepo-1');
  await page.screenshot({ path: 'artifacts/screenshots/portrait/stage.png' });
  await tap(page, (await wgz(page)).map!.stagePanel!.go);
  await waitScene(page, 'ExpeditionScene');

  // 3. 隊伍預設帶入組隊編排的 3 隻
  let e = (await wgz(page)).expeditionPanel!;
  expect(e.stageId).toBe('luoyepo-1');
  expect(e.teamCards.map((c) => c.id)).toEqual(['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai']);
  expect(e.teamCards.filter((c) => c.selected).map((c) => c.id)).toEqual([
    'daer',
    'heixuan',
    'changxu',
  ]);
  expect(e.confirmButton).toMatchObject({ label: '出發！', enabled: true });
  // 滿 3 隻時點第 4 隻沒反應
  await tap(page, e.teamCards[3]);
  e = (await wgz(page)).expeditionPanel!;
  expect(e.teamCards[3].selected).toBe(false);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/team-pick.png' });

  // 4. 出發 → 回主頁倒數
  await tap(page, e.confirmButton!);
  await page.waitForFunction(
    () => window.__WGZ__?.scene === 'LobbyScene' && !!window.__WGZ__.expedition,
  );
  let s = await wgz(page);
  expect(s.expedition!.complete).toBe(false);
  expect(s.status!.label).toMatch(/^坡腳小徑 出征中 00:0[1-5]$/);
  expect(s.status!.enabled).toBe(false);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/countdown.png' });

  // 5. 時間到 → 收成
  await page.waitForFunction(() => window.__WGZ__?.expedition?.complete === true, null, {
    timeout: 10_000,
  });
  s = await wgz(page);
  expect(s.status).toMatchObject({ label: '收成！ 坡腳小徑', enabled: true });
  await tap(page, s.status!);
  await page.waitForFunction(() => !!window.__WGZ__?.result);
  s = await wgz(page);
  expect(s.result).toEqual({ food: 120, bones: 5 });
  expect(s.resources).toEqual({ food: 1320, bones: 55 });
  await page.screenshot({ path: 'artifacts/screenshots/portrait/harvest.png' });

  // 6. 關掉結果 → 第一次過關的劇情自動播放
  await tap(page, { x: 0, y: 800, width: 390, height: 20 });
  await waitScene(page, 'StoryScene');
  let story = (await wgz(page)).story!;
  expect(story).toMatchObject({ mode: 'play', playing: 'ch1-first', line: 0, total: 3 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/story.png' });
  for (let i = 0; i < story.total; i++) await tap(page, { x: 100, y: 300, width: 0, height: 0 });
  await waitScene(page, 'LobbyScene');

  // 7. 地圖上第 1 關打勾、第 2 關開放
  await tap(page, (await wgz(page)).lobby!.buttons.expedition);
  await waitScene(page, 'CampaignScene');
  m = (await wgz(page)).map!;
  expect(m.nodes.map((n) => n.state)).toEqual(['cleared', 'open', 'locked', 'locked', 'locked']);

  // 劇情回顧裡也看得到
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  await tap(page, (await wgz(page)).lobby!.buttons.story);
  await waitScene(page, 'StoryScene');
  story = (await wgz(page)).story!;
  expect(story.items.filter((i) => i.unlocked).map((i) => i.id)).toEqual(['prologue', 'ch1-first']);
});

test('選隊伍卡片整塊都點得到（四個角落）', async ({ page }) => {
  await openLobby(page);
  await tap(page, (await wgz(page)).lobby!.buttons.expedition, 0.9, 0.9);
  await waitScene(page, 'CampaignScene');
  await tap(page, (await wgz(page)).map!.nodes[0], 0.8, 0.8);
  await page.waitForFunction(() => !!window.__WGZ__?.map?.stagePanel);
  await tap(page, (await wgz(page)).map!.stagePanel!.go, 0.95, 0.9);
  await waitScene(page, 'ExpeditionScene');

  const cards = (await wgz(page)).expeditionPanel!.teamCards;
  const selected = (id: string) =>
    page.evaluate(
      (id) => window.__WGZ__?.expeditionPanel?.teamCards.find((x) => x.id === id)?.selected,
      id,
    );
  const spots: [number, number][] = [
    [0.9, 0.85],
    [0.1, 0.85],
    [0.9, 0.15],
  ];
  for (const [i, [fx, fy]] of spots.entries()) {
    const c = cards[i];
    await tap(page, c, fx, fy);
    expect(await selected(c.id), `第 ${i + 1} 張點 (${fx}, ${fy})`).toBe(false);
    await tap(page, c, fx, fy);
    expect(await selected(c.id)).toBe(true);
  }
  // 返回地圖
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'CampaignScene');
});
