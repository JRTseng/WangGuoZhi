import { expect, test } from '@playwright/test';
import { openLobby, tap, waitScene, wgz } from './helpers';

test('組隊：全部角色、未擁有變暗、編隊與設定主頁角色', async ({ page }) => {
  await openLobby(page);
  await tap(page, (await wgz(page)).lobby!.buttons.team);
  await waitScene(page, 'TeamScene');

  let t = (await wgz(page)).team!;
  // T024 起共 30 隻
  expect(t.dogs).toHaveLength(30);
  // 預設：全部、戰力高到低，擁有的排前面
  const unowned = [
    'nuantong',
    'xiongyue',
    'liuxing',
    'songling',
    'xueling',
    'fuqiu',
    'haiyan',
    'tieya',
    'jiying',
    'shanlan',
    'shuangtong',
    'jinling',
    'yuandun',
    'modian',
    'maisui',
    'zhuifeng',
    'caiyi',
    'ronger',
    'shuangyan',
    'duantui',
    'shidun',
    'chanbi',
    'changgong',
    'zhouzhou',
    'douding',
  ];
  expect(t.dogs.map((d) => d.id)).toEqual([
    'changxu',
    'daer',
    'heixuan',
    'xiaosuan',
    'abai',
    ...unowned,
  ]);
  expect(t.dogs.filter((d) => !d.owned).map((d) => d.id)).toEqual(unowned);
  const cell = async (id: string) => (await wgz(page)).team!.dogs.find((d) => d.id === id)!;
  expect(t.slots.map((s) => s.id)).toEqual(['daer', 'heixuan', 'changxu', null, null]);
  for (const slot of t.slots) expect(slot.x + slot.width).toBeLessThanOrEqual(844);
  // 狗多了卡片格可以捲動：看得到的都在畫面內，擁有的 5 隻一進來就看得到
  for (const d of t.dogs) {
    expect(d.x + d.width).toBeLessThanOrEqual(844);
    if (d.visible) expect(d.y + d.height).toBeLessThanOrEqual(390);
    if (d.owned) expect(d.visible).toBe(true);
  }
  await page.screenshot({ path: 'artifacts/screenshots/landscape/team.png' });

  // 未擁有：可以看資料，但沒有編隊按鈕（橫式要先往下捲才看得到）
  const grid = (await wgz(page)).picker!.grid;
  await page.mouse.move(grid.x + grid.width / 2, grid.y + grid.height / 2);
  for (let i = 0; i < 20 && !(await cell('tieya')).visible; i++) {
    await page.mouse.wheel(0, 60);
    await page.waitForTimeout(80);
  }
  expect((await cell('tieya')).visible).toBe(true);
  await tap(page, await cell('tieya'));
  await page.waitForFunction(() => window.__WGZ__?.team?.panel === 'tieya');
  expect((await wgz(page)).team!.panelButtons).toEqual({});
  await page.screenshot({ path: 'artifacts/screenshots/landscape/team-locked.png' });
  await tap(page, { x: 0, y: 380, width: 844, height: 6 });
  await page.waitForFunction(() => window.__WGZ__?.team?.panel === null);
  await page.mouse.move(grid.x + grid.width / 2, grid.y + grid.height / 2);
  await page.mouse.wheel(0, -2000);
  await page.waitForFunction(() => window.__WGZ__?.picker?.scrollY === 0);

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

  await tap(page, { x: 0, y: 380, width: 844, height: 6 });
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
  expect(p.cells).toHaveLength(30);

  // 定位：守護（擁有的排前面，其餘依戰力）
  await tap(page, await chip('roleChips', '守護'));
  expect(await ids()).toEqual(['changxu', 'xiongyue', 'tieya', 'yuandun', 'shidun']);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/team-filter.png' });
  // 再疊狀態：可出征（未擁有的不算）
  await tap(page, await chip('statusChips', 'idle'));
  expect(await ids()).toEqual(['changxu']);
  // 出征中：目前沒有
  await tap(page, await chip('statusChips', 'busy'));
  expect(await ids()).toEqual([]);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/team-filter-empty.png' });
  // 回到全部
  await tap(page, await chip('statusChips', 'all'));
  await tap(page, await chip('roleChips', 'all'));
  expect(await ids()).toHaveLength(30);

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
  // 排序：稀有度（T007）。擁有的排前面：R 三隻、N 兩隻；接著是沒擁有的 SSR
  await tap(page, p.sortChip);
  p = (await wgz(page)).picker!;
  expect(p.sort).toBe('rarity');
  expect(p.cells.slice(0, 7).map((c) => c.id)).toEqual([
    'changxu',
    'daer',
    'heixuan',
    'xiaosuan',
    'abai',
    'nuantong',
    'xiongyue',
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
  await page.screenshot({ path: 'artifacts/screenshots/landscape/team-auto.png' });

  // 隊伍滿了，篩選列與卡片仍在畫面內
  p = (await wgz(page)).picker!;
  for (const r of [...p.roleChips, ...p.statusChips, p.sortChip, p.autoButton, ...p.slots]) {
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(844);
  }
});
