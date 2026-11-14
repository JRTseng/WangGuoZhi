import { expect, test } from '@playwright/test';
import { openLobby, tap, waitScene, wgz } from './helpers';

test('出征地圖 → 選隊伍 → 開戰 → 戰鬥 → 劇情 → 下一關開放', async ({ page }) => {
  // 完整流程多次換畫面，給比預設 30 秒寬的時間
  test.setTimeout(60_000);
  await openLobby(page, '?fast=1');
  await tap(page, (await wgz(page)).lobby!.buttons.expedition);
  await waitScene(page, 'CampaignScene');

  // 1. 三章，只有第一章開放；5 個節點，最後一個是 Boss
  let m = (await wgz(page)).map!;
  expect(m.chapters.map((c) => c.unlocked)).toEqual([
    true,
    ...Array.from({ length: 9 }, () => false),
  ]);
  expect(m.nodes.map((n) => n.state)).toEqual(['open', 'locked', 'locked', 'locked', 'locked']);
  expect(m.nodes.map((n) => n.boss)).toEqual([false, false, false, false, true]);
  expect(m.nodes[4].width).toBeGreaterThan(m.nodes[0].width);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/map.png' });

  // 鎖住的章節、關卡點了不會動
  await tap(page, m.chapters[1]);
  await tap(page, m.nodes[1]);
  m = (await wgz(page)).map!;
  expect(m.chapter).toBe(0);
  expect(m.stagePanel).toBeNull();

  // 2. 點第 1 關 → 關卡詳情 → 選隊伍出發
  await tap(page, m.nodes[0]);
  await page.waitForFunction(() => window.__WGZ__?.map?.stagePanel?.stageId === 'luoyepo-1');
  await page.screenshot({ path: 'artifacts/screenshots/landscape/stage.png' });
  await tap(page, (await wgz(page)).map!.stagePanel!.go);
  await waitScene(page, 'ExpeditionScene');

  // 3. 隊伍預設帶入組隊編排的 3 隻
  let e = (await wgz(page)).expeditionPanel!;
  expect(e.stageId).toBe('luoyepo-1');
  // 只列擁有的狗，預設戰力高到低
  expect(e.teamCards.map((c) => c.id)).toEqual(['changxu', 'daer', 'heixuan', 'xiaosuan', 'abai']);
  expect(e.teamCards.filter((c) => c.selected).map((c) => c.id)).toEqual([
    'changxu',
    'daer',
    'heixuan',
  ]);
  expect((await wgz(page)).picker!.slots.map((s) => s.id)).toEqual([
    'daer',
    'heixuan',
    'changxu',
    null,
    null,
  ]);
  expect(e.confirmButton).toMatchObject({ label: '開戰！', enabled: true });
  expect(e.buyButton).toBeNull();
  expect(e.runsLeft).toBe(3);
  // 隊伍最多 5 隻：可以再加第 4 隻，再點一次取消
  await tap(page, e.teamCards[3]);
  e = (await wgz(page)).expeditionPanel!;
  expect(e.teamCards[3].selected).toBe(true);
  expect(e.confirmButton).toMatchObject({ label: '開戰！', enabled: true });
  await tap(page, e.teamCards[3]);
  e = (await wgz(page)).expeditionPanel!;
  expect(e.teamCards[3].selected).toBe(false);
  // 篩選：謀略只剩小算；回到全部
  let pk = (await wgz(page)).picker!;
  await tap(
    page,
    pk.roleChips.find((c) => c.key === '謀略')!,
  );
  expect((await wgz(page)).expeditionPanel!.teamCards.map((c) => c.id)).toEqual(['xiaosuan']);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/team-pick-filter.png' });
  await tap(page, pk.roleChips[0]);
  // 自動編隊選滿 5 隻；點九宮格上的狗可以移出，滿了再點別隻沒反應
  await tap(page, pk.autoButton);
  pk = (await wgz(page)).picker!;
  expect(pk.slots.map((s) => s.id)).toEqual(['changxu', 'daer', 'heixuan', 'xiaosuan', 'abai']);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/team-pick-auto.png' });
  // 隊伍格現在是九宮格上的格子：點一下移出一隻，重新讀位置再移出下一隻
  await tap(page, pk.slots[3]);
  await tap(page, (await wgz(page)).picker!.slots[3]);
  e = (await wgz(page)).expeditionPanel!;
  expect(e.teamCards.filter((c) => c.selected).map((c) => c.id)).toEqual([
    'changxu',
    'daer',
    'heixuan',
  ]);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/team-pick.png' });

  // 4. 開戰 → 不用等，直接進戰鬥畫面；體力 -20
  await tap(page, e.confirmButton!);
  // 預設會進戰鬥畫面，播完顯示結算（測試模式下約 1 秒播完）
  await waitScene(page, 'BattleScene');
  await page.waitForFunction(() => !!window.__WGZ__?.result);
  const s = await wgz(page);
  expect(s.battle).toMatchObject({ stageId: 'luoyepo-1', win: true, phase: 'result' });
  expect(s.battle!.skipped).toBe(false);
  expect(s.battle!.index).toBe(s.battle!.total);
  expect(s.result).toEqual({ food: 120, bones: 5, win: true });
  await page.screenshot({ path: 'artifacts/screenshots/landscape/result.png' });

  // 5. 關掉結算 → 第一次過關的劇情自動播放
  await tap(page, { x: 0, y: 380, width: 844, height: 6 });
  await waitScene(page, 'StoryScene');
  let story = (await wgz(page)).story!;
  expect(story).toMatchObject({ mode: 'play', playing: 'ch1-first', line: 0, total: 3 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/story.png' });
  for (let i = 0; i < story.total; i++) await tap(page, { x: 100, y: 300, width: 0, height: 0 });
  await waitScene(page, 'LobbyScene');
  expect((await wgz(page)).resources).toEqual({ food: 1320, bones: 55 });
  // 測試模式體力 5 秒回 1 點，留一點誤差
  const stamina = (await wgz(page)).stamina!.value;
  expect(stamina).toBeGreaterThanOrEqual(80);
  expect(stamina).toBeLessThan(90);

  // 6. 地圖上第 1 關打勾、第 2 關開放
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
