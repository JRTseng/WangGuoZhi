import { expect, test } from '@playwright/test';
import { openLobby, tap, waitScene, wgz } from './helpers';

test('組隊：全部角色、未擁有變暗、編隊與設定主頁角色', async ({ page }) => {
  await openLobby(page);
  await tap(page, (await wgz(page)).lobby!.buttons.team);
  await waitScene(page, 'TeamScene');

  let t = (await wgz(page)).team!;
  expect(t.dogs).toHaveLength(8);
  expect(t.dogs.filter((d) => !d.owned).map((d) => d.id)).toEqual([
    'tieya',
    'duantui',
    'shuangyan',
  ]);
  expect(t.slots.map((s) => s.id)).toEqual(['daer', 'heixuan', 'changxu']);
  for (const d of t.dogs) {
    expect(d.x + d.width).toBeLessThanOrEqual(390);
    expect(d.y + d.height).toBeLessThanOrEqual(844);
  }
  await page.screenshot({ path: 'artifacts/screenshots/portrait/team.png' });

  // 未擁有：可以看資料，但沒有編隊按鈕
  await tap(page, t.dogs[5]);
  await page.waitForFunction(() => window.__WGZ__?.team?.panel === 'tieya');
  expect((await wgz(page)).team!.panelButtons).toEqual({});
  await page.screenshot({ path: 'artifacts/screenshots/portrait/team-locked.png' });
  await tap(page, { x: 0, y: 820, width: 390, height: 10 });
  await page.waitForFunction(() => window.__WGZ__?.team?.panel === null);

  // 點隊伍格移出黑旋
  await tap(page, t.slots[1]);
  await page.waitForFunction(() => window.__WGZ__?.team?.slots[2].id === null);
  t = (await wgz(page)).team!;
  expect(t.slots.map((s) => s.id)).toEqual(['daer', 'changxu', null]);

  // 阿白：加入隊伍、設為主頁角色
  await tap(page, t.dogs[4]);
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
