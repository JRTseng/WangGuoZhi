import { expect, test } from '@playwright/test';
import { openLobby, tap, waitScene, wgz } from './helpers';

test('組隊：全部角色、未擁有變暗、編隊與設定主頁角色', async ({ page }) => {
  await openLobby(page);
  await tap(page, (await wgz(page)).lobby!.buttons.team);
  await waitScene(page, 'TeamScene');

  let t = (await wgz(page)).team!;
  expect(t.dogs).toHaveLength(9);
  // 預設：全部、戰力高到低，擁有的排前面
  expect(t.dogs.map((d) => d.id)).toEqual([
    'changxu',
    'daer',
    'heixuan',
    'xiaosuan',
    'abai',
    'nuantong',
    'tieya',
    'shuangyan',
    'duantui',
  ]);
  expect(t.dogs.filter((d) => !d.owned).map((d) => d.id)).toEqual([
    'nuantong',
    'tieya',
    'shuangyan',
    'duantui',
  ]);
  const cell = async (id: string) => (await wgz(page)).team!.dogs.find((d) => d.id === id)!;
  expect(t.slots.map((s) => s.id)).toEqual(['daer', 'heixuan', 'changxu', null, null]);
  for (const slot of t.slots) expect(slot.x + slot.width).toBeLessThanOrEqual(390);
  for (const d of t.dogs) {
    expect(d.x + d.width).toBeLessThanOrEqual(390);
    expect(d.y + d.height).toBeLessThanOrEqual(844);
  }
  await page.screenshot({ path: 'artifacts/screenshots/portrait/team.png' });

  // 未擁有：可以看資料，但沒有編隊按鈕
  await tap(page, await cell('tieya'));
  await page.waitForFunction(() => window.__WGZ__?.team?.panel === 'tieya');
  expect((await wgz(page)).team!.panelButtons).toEqual({});
  await page.screenshot({ path: 'artifacts/screenshots/portrait/team-locked.png' });
  await tap(page, { x: 0, y: 820, width: 390, height: 10 });
  await page.waitForFunction(() => window.__WGZ__?.team?.panel === null);

  // 點隊伍格移出黑旋
  await tap(page, t.slots[1]);
  await page.waitForFunction(() => window.__WGZ__?.team?.slots[2].id === null);
  t = (await wgz(page)).team!;
  expect(t.slots.map((s) => s.id)).toEqual(['daer', 'changxu', null, null, null]);

  // 阿白：加入隊伍、設為主頁角色
  await tap(page, await cell('abai'));
  await page.waitForFunction(() => window.__WGZ__?.team?.panel === 'abai');
  const btns = (await wgz(page)).team!.panelButtons!;
  await tap(page, btns.team!);
  await page.waitForFunction(() => window.__WGZ__?.team?.slots[2].id === 'abai');
  await tap(page, btns.lobby!);
  await page.waitForFunction(() => window.__WGZ__?.team?.lobbyDogId === 'abai');

  await tap(page, { x: 0, y: 820, width: 390, height: 10 });
  await page.waitForFunction(() => window.__WGZ__?.team?.panel === null);
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  expect((await wgz(page)).lobby!.dogId).toBe('abai');
});

test('組隊：篩選、排序、自動編隊', async ({ page }) => {
  await openLobby(page);
  await tap(page, (await wgz(page)).lobby!.buttons.team);
  await waitScene(page, 'TeamScene');
  const ids = async () => (await wgz(page)).picker!.cells.map((c) => c.id);
  const chip = async (row: 'roleChips' | 'statusChips', key: string) =>
    (await wgz(page)).picker![row].find((c) => c.key === key)!;

  let p = (await wgz(page)).picker!;
  expect(p.filter).toEqual({ role: 'all', status: 'all' });
  expect(p.sort).toBe('power');
  expect(p.cells).toHaveLength(9);

  // 定位：守護
  await tap(page, await chip('roleChips', '守護'));
  expect(await ids()).toEqual(['changxu', 'tieya']);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/team-filter.png' });
  // 再疊狀態：可出征（未擁有的鐵牙不算）
  await tap(page, await chip('statusChips', 'idle'));
  expect(await ids()).toEqual(['changxu']);
  // 出征中：目前沒有
  await tap(page, await chip('statusChips', 'busy'));
  expect(await ids()).toEqual([]);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/team-filter-empty.png' });
  // 回到全部
  await tap(page, await chip('statusChips', 'all'));
  await tap(page, await chip('roleChips', 'all'));
  expect(await ids()).toHaveLength(9);

  // 排序：等級
  await tap(page, (await wgz(page)).picker!.sortChip);
  p = (await wgz(page)).picker!;
  expect(p.sort).toBe('level');
  expect(p.cells.slice(0, 5).map((c) => c.id)).toEqual([
    'daer',
    'changxu',
    'heixuan',
    'xiaosuan',
    'abai',
  ]);
  await tap(page, p.sortChip);
  expect((await wgz(page)).picker!.sort).toBe('power');

  // 自動編隊：戰力最高的 5 隻
  await tap(page, (await wgz(page)).picker!.autoButton);
  expect((await wgz(page)).team!.slots.map((s) => s.id)).toEqual([
    'changxu',
    'daer',
    'heixuan',
    'xiaosuan',
    'abai',
  ]);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/team-auto.png' });

  // 隊伍滿了，篩選列與卡片仍在畫面內
  p = (await wgz(page)).picker!;
  for (const r of [...p.roleChips, ...p.statusChips, p.sortChip, p.autoButton, ...p.slots]) {
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(390);
  }
});
