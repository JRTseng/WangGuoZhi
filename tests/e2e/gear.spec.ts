import { expect, test } from '@playwright/test';
import { openLobby, patchSave, tap, waitScene, wgz } from './helpers';

const SHOTS = 'artifacts/screenshots/landscape';
const GEAR = {
  'boxing-quanquan': 1,
  'mitt-taojiaoqing': 2,
  'sweater-wufeng': 1,
  'shorts-kuku': 1,
  'boots-yuguotianxie': 1,
  'crown-yiguandaodi': 1,
  'cone-taolao': 1,
  'bib-douzhezou': 1,
  'robe-yimingjingren': 1,
  'sneaker-wuxiekeji': 1,
};

test('倉庫：空的時候有說明；有裝備可以依部位篩選、穿上、脫下、換狗', async ({ page }) => {
  await openLobby(page, '?fast=1');
  // 主頁「倉庫」已開放
  await tap(page, (await wgz(page)).lobby!.buttons.bag);
  await waitScene(page, 'GearScene');
  let s = (await wgz(page)).gear!;
  expect(s).toMatchObject({ dogId: 'daer', total: 0, tab: 'all' });
  expect(s.items).toHaveLength(0);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/gear-empty.png` });
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');

  await patchSave(page, { gear: GEAR });
  await tap(page, (await wgz(page)).lobby!.buttons.bag);
  await waitScene(page, 'GearScene');
  s = (await wgz(page)).gear!;
  expect(s.total).toBe(11);
  expect(s.items).toHaveLength(10);
  expect(s.tabs.map((t) => t.key)).toEqual(['all', 'clothes', 'gloves', 'pants', 'shoes', 'head']);
  for (const r of [...s.tabs, ...s.slots, s.prev, s.next]) {
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(844);
    expect(r.y + r.height).toBeLessThanOrEqual(390);
  }
  const before = s.stats;
  await page.screenshot({ path: `${SHOTS}/gear-warehouse.png` });

  // 依部位篩選：手套有兩種
  await tap(
    page,
    s.tabs.find((t) => t.key === 'gloves')!,
  );
  await page.waitForFunction(() => window.__WGZ__?.gear?.tab === 'gloves');
  s = (await wgz(page)).gear!;
  expect(s.items.map((i) => i.id)).toEqual(['boxing-quanquan', 'mitt-taojiaoqing']);
  expect(s.items.every((i) => i.visible)).toBe(true);
  await page.screenshot({ path: `${SHOTS}/gear-filter.png` });

  // 穿上拳拳到肉球：攻擊 +4
  await tap(page, s.items[0]);
  await page.waitForFunction(() => window.__WGZ__?.gear?.slots[1].gearId === 'boxing-quanquan');
  s = (await wgz(page)).gear!;
  expect(s.stats.attack).toBe(before.attack + 4);
  expect(s.stats.power).toBe(before.power + 4);
  expect(s.items[0]).toMatchObject({ wearing: true, spare: 0 });
  expect(s.note).toContain('拳拳到肉');

  // 換成套交情手套：同一個部位只穿一件，攻擊變 +2
  await tap(page, s.items[1]);
  await page.waitForFunction(() => window.__WGZ__?.gear?.slots[1].gearId === 'mitt-taojiaoqing');
  s = (await wgz(page)).gear!;
  expect(s.stats.attack).toBe(before.attack + 2);
  expect(s.items[0]).toMatchObject({ wearing: false, spare: 1 });

  // 再點一次脫下
  await tap(page, s.items[1]);
  await page.waitForFunction(() => window.__WGZ__?.gear?.slots[1].gearId === null);
  expect((await wgz(page)).gear!.stats).toEqual(before);

  // 一鍵穿上：五個部位都挑最好的
  await tap(page, s.autoButton);
  await page.waitForFunction(() => window.__WGZ__?.gear?.slots.every((x) => !!x.gearId));
  s = (await wgz(page)).gear!;
  expect(s.slots.map((x) => x.gearId)).toEqual([
    'robe-yimingjingren',
    'boxing-quanquan',
    'shorts-kuku',
    'sneaker-wuxiekeji',
    'crown-yiguandaodi',
  ]);
  expect(s.stats.gearAttack + s.stats.gearDefense).toBe(12 + 4 + 4 + 12 + 12);
  expect(s.stats.power).toBe(before.power + 44);
  // 點裝備格跳到那個部位的分頁
  await tap(page, s.slots[4]);
  await page.waitForFunction(() => window.__WGZ__?.gear?.tab === 'head');
  await tap(page, (await wgz(page)).gear!.tabs[0]);
  await page.waitForFunction(() => window.__WGZ__?.gear?.tab === 'all');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/gear-equipped.png` });

  // 清單超過一頁可以捲
  s = (await wgz(page)).gear!;
  expect(s.scrollMax).toBeGreaterThan(0);
  await page.mouse.wheel(0, 400);
  await page.waitForFunction(() => (window.__WGZ__?.gear?.scrollY ?? 0) > 0);

  // 換下一隻狗（黑旋）：只剩一件的拳拳到肉球從大耳身上換過來
  await tap(page, s.next);
  await page.waitForFunction(() => window.__WGZ__?.gear?.dogId === 'heixuan');
  await tap(
    page,
    (await wgz(page)).gear!.tabs.find((t) => t.key === 'gloves')!,
  );
  await page.waitForFunction(() => window.__WGZ__?.gear?.tab === 'gloves');
  s = (await wgz(page)).gear!;
  expect(s.items[0]).toMatchObject({ id: 'boxing-quanquan', wearing: false, spare: 0 });
  await tap(page, s.items[0]);
  await page.waitForFunction(() => window.__WGZ__?.gear?.slots[1].gearId === 'boxing-quanquan');
  expect((await wgz(page)).gear!.note).toContain('大耳');
  await tap(page, (await wgz(page)).gear!.prev);
  await page.waitForFunction(() => window.__WGZ__?.gear?.dogId === 'daer');
  expect((await wgz(page)).gear!.slots[1].gearId).toBeNull();

  // 回主頁：狗狗穿著裝備；重新整理後還在（有存檔）
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/gear-lobby.png` });
  await page.reload();
  await waitScene(page, 'LobbyScene');
  await tap(page, (await wgz(page)).lobby!.buttons.bag);
  await waitScene(page, 'GearScene');
  expect((await wgz(page)).gear!.slots.map((x) => x.gearId)).toEqual([
    'robe-yimingjingren',
    null,
    'shorts-kuku',
    'sneaker-wuxiekeji',
    'crown-yiguandaodi',
  ]);
});

test('角色資訊的「裝備」按鈕進倉庫看那隻狗，返回回到組隊', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await tap(page, (await wgz(page)).lobby!.buttons.team);
  await waitScene(page, 'TeamScene');
  const cell = (await wgz(page)).picker!.cells.find((c) => c.id === 'abai')!;
  await tap(page, cell);
  await page.waitForFunction(() => window.__WGZ__?.team?.panel === 'abai');
  const buttons = (await wgz(page)).team!.panelButtons!;
  expect(buttons.gear).toBeTruthy();
  await page.screenshot({ path: `${SHOTS}/gear-dog-info.png` });
  await tap(page, buttons.gear!);
  await waitScene(page, 'GearScene');
  expect((await wgz(page)).gear!.dogId).toBe('abai');
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'TeamScene');
});

test('專屬裝備：有那隻狗就送，只有牠能穿，SSR 的攻防再多 5%', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await patchSave(page, {
    owned: ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai', 'tieya', 'xiongyue'],
    lobbyDogId: 'daer',
  });
  await tap(page, (await wgz(page)).lobby!.buttons.bag);
  await waitScene(page, 'GearScene');
  let s = (await wgz(page)).gear!;
  // 讀檔時補發：鐵牙（SR）、熊嶽（SSR）各一件
  expect(s.total).toBe(2);
  expect(s.items.map((i) => [i.id, i.exclusive])).toEqual([
    ['ex-tieya', 'tieya'],
    ['ex-xiongyue', 'xiongyue'],
  ]);
  // 大耳穿不了熊嶽的專屬
  await tap(page, s.items[1]);
  await page.waitForFunction(() => window.__WGZ__?.gear?.note.includes('專屬'));
  expect((await wgz(page)).gear!.slots.every((x) => x.gearId === null)).toBe(true);

  // 換到熊嶽，穿上自己的專屬
  for (let i = 0; i < 8 && (await wgz(page)).gear!.dogId !== 'xiongyue'; i++) {
    const cur = (await wgz(page)).gear!.dogId;
    await tap(page, (await wgz(page)).gear!.next);
    await page.waitForFunction((id) => window.__WGZ__?.gear?.dogId !== id, cur);
  }
  s = (await wgz(page)).gear!;
  expect(s.dogId).toBe('xiongyue');
  const before = s.stats;
  await tap(page, s.items[1]);
  await page.waitForFunction(() => window.__WGZ__?.gear?.slots[2].gearId === 'ex-xiongyue');
  s = (await wgz(page)).gear!;
  expect(s.stats.gearAttack).toBe(4 + Math.round(before.attack * 0.05));
  expect(s.stats.gearDefense).toBe(12 + Math.round(before.defense * 0.05));
  expect(s.stats.power).toBe(before.power + s.stats.gearAttack + s.stats.gearDefense);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/gear-exclusive.png` });
});
