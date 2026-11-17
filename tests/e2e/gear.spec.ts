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
  expect(s.tabs.map((t) => t.key)).toEqual([
    'all',
    'clothes',
    'gloves',
    'pants',
    'shoes',
    'head',
    'acc',
  ]);
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
  await page.waitForFunction(() =>
    window.__WGZ__?.gear?.slots.slice(0, 5).every((x) => !!x.gearId),
  );
  s = (await wgz(page)).gear!;
  expect(s.slots.map((x) => x.gearId)).toEqual([
    'robe-yimingjingren',
    'boxing-quanquan',
    'shorts-kuku',
    'sneaker-wuxiekeji',
    'crown-yiguandaodi',
    null,
    null,
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
    null,
    null,
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

test('飾品：爬塔送的鈴鐺、蝴蝶結戴在頸飾、耳飾的位置，不佔原本五個部位', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await patchSave(page, {
    gear: { 'tw-20': 1, 'tw-40': 1, 'tw-60': 1, 'tw-80': 1, 'tw-100': 1, 'crown-yiguandaodi': 1 },
    // 舊存檔：鈴鐺那一件原本是帽子，穿在頭飾的位置
    equipped: { daer: { head: 'tw-20' } },
  });
  await tap(page, (await wgz(page)).lobby!.buttons.bag);
  await waitScene(page, 'GearScene');
  let s = (await wgz(page)).gear!;
  expect(s.slots.map((x) => x.slot)).toEqual([
    'clothes',
    'gloves',
    'pants',
    'shoes',
    'head',
    'neck',
    'ear',
  ]);
  // 舊存檔戴在頭上的那一件，自動搬到頸飾
  expect(s.slots[4].gearId).toBeNull();
  expect(s.slots[5].gearId).toBe('tw-20');
  // 點飾品格跳到「飾品」分頁，五件都在
  await tap(page, s.slots[6]);
  await page.waitForFunction(() => window.__WGZ__?.gear?.tab === 'acc');
  s = (await wgz(page)).gear!;
  expect(s.items.map((i) => i.id).sort()).toEqual(['tw-100', 'tw-20', 'tw-40', 'tw-60', 'tw-80']);
  await tap(
    page,
    s.items.find((i) => i.id === 'tw-40')!,
  );
  await page.waitForFunction(() => window.__WGZ__?.gear?.slots[6].gearId === 'tw-40');
  // 帽子照樣可以戴，和飾品不衝突
  await tap(page, (await wgz(page)).gear!.autoButton);
  await page.waitForFunction(() => window.__WGZ__?.gear?.slots[4].gearId === 'crown-yiguandaodi');
  s = (await wgz(page)).gear!;
  expect(s.slots[5].gearId).not.toBeNull();
  expect(s.slots[6].gearId).not.toBeNull();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/gear-accessories.png` });
  // 換一條頸飾
  await tap(
    page,
    s.items.find((i) => i.id === 'tw-60')!,
  );
  await page.waitForFunction(() => window.__WGZ__?.gear?.slots[5].gearId === 'tw-60');
  await tap(
    page,
    (await wgz(page)).gear!.items.find((i) => i.id === 'tw-80')!,
  );
  await page.waitForFunction(() => window.__WGZ__?.gear?.slots[6].gearId === 'tw-80');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/gear-accessories-2.png` });
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/gear-accessories-lobby.png` });
});

test('裝備升星：點圖示開視窗升星、全部升星、專屬裝備花碎片，重新整理後還在', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await patchSave(page, {
    owned: ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai', 'tieya'],
    lobbyDogId: 'daer',
    gear: { 'boxing-quanquan': 4, 'mitt-taojiaoqing': 2, 'sweater-wufeng': 1 },
    shards: { tieya: 5 },
  });
  await tap(page, (await wgz(page)).lobby!.buttons.bag);
  await waitScene(page, 'GearScene');
  let s = (await wgz(page)).gear!;
  const item = async (id: string) => (await wgz(page)).gear!.items.find((i) => i.id === id)!;
  // 兩種手套有多的同款可以升；毛衣只有一件、專屬要自己點，不算在「全部升星」裡
  expect(s.starReady).toBe(2);
  expect(s.starPanel).toBeNull();
  for (const r of [s.starAllButton, s.autoButton]) {
    expect(r.x + r.width).toBeLessThanOrEqual(844);
    expect(r.y + r.height).toBeLessThanOrEqual(56);
  }
  expect(s.starAllButton.x + s.starAllButton.width).toBeLessThanOrEqual(s.autoButton.x);

  await tap(
    page,
    s.tabs.find((t) => t.key === 'gloves')!,
  );
  await page.waitForFunction(() => window.__WGZ__?.gear?.tab === 'gloves');
  // 點卡片右邊照舊是穿上（拳拳到肉球 攻 +4）
  const before = (await wgz(page)).gear!.stats;
  await tap(page, await item('boxing-quanquan'), 0.7);
  await page.waitForFunction(() => window.__WGZ__?.gear?.slots[1].gearId === 'boxing-quanquan');
  expect((await wgz(page)).gear!.stats.attack).toBe(before.attack + 4);
  expect(await item('boxing-quanquan')).toMatchObject({ star: 0, canStar: true, count: 4 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/gear-star-list.png` });

  // 點圖示開升星視窗
  await tap(page, (await item('boxing-quanquan')).icon);
  await page.waitForFunction(() => window.__WGZ__?.gear?.starPanel?.gearId === 'boxing-quanquan');
  let p = (await wgz(page)).gear!.starPanel!;
  expect(p).toMatchObject({ star: 0, ok: true });
  for (const r of [p.up, p.close]) {
    expect(r.height).toBeGreaterThanOrEqual(44);
    expect(r.y + r.height).toBeLessThanOrEqual(390);
  }
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/gear-star-panel.png` });

  // 升一星：吃掉一件同款，穿著的狗攻擊馬上多 1（4 → 5）
  await tap(page, p.up);
  await page.waitForFunction(() => window.__WGZ__?.gear?.starPanel?.star === 1);
  s = (await wgz(page)).gear!;
  expect(s.stats.attack).toBe(before.attack + 5);
  expect(s.starPanel!.message).toContain('★1');
  expect(await item('boxing-quanquan')).toMatchObject({ star: 1, count: 3 });
  // 再升一星：剩 2 件，其中一件穿著、多的只有一件，第三星要兩件所以不夠
  await tap(page, s.starPanel!.up);
  await page.waitForFunction(() => window.__WGZ__?.gear?.starPanel?.star === 2);
  p = (await wgz(page)).gear!.starPanel!;
  expect(p.ok).toBe(false);
  expect((await wgz(page)).gear!.stats.attack).toBe(before.attack + 6);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/gear-star-short.png` });
  // 材料不夠時按升星沒有反應
  await tap(page, p.up);
  await page.waitForTimeout(150);
  expect(await item('boxing-quanquan')).toMatchObject({ star: 2, count: 2, canStar: false });
  // 視窗開著的時候點不到後面的卡片
  expect((await wgz(page)).gear!.slots[1].gearId).toBe('boxing-quanquan');
  await tap(page, p.close);
  await page.waitForFunction(() => window.__WGZ__?.gear?.starPanel === null);

  // 全部升星：套交情手套多一件，升到 ★1
  s = (await wgz(page)).gear!;
  expect(s.starReady).toBe(1);
  await tap(page, s.starAllButton);
  await page.waitForFunction(() => window.__WGZ__?.gear?.starReady === 0);
  expect(await item('mitt-taojiaoqing')).toMatchObject({ star: 1, count: 1 });
  expect((await wgz(page)).gear!.note).toContain('★1');
  // 沒得升的時候再按只會提示
  await tap(page, (await wgz(page)).gear!.starAllButton);
  await page.waitForFunction(() => window.__WGZ__?.gear?.note.includes('沒有可以升星'));

  // 專屬裝備花那隻狗的碎片：鐵牙碎片 5 個剛好升一星，之後不夠
  await tap(
    page,
    (await wgz(page)).gear!.tabs.find((t) => t.key === 'clothes')!,
  );
  await page.waitForFunction(() => window.__WGZ__?.gear?.tab === 'clothes');
  expect(await item('ex-tieya')).toMatchObject({ star: 0, canStar: true });
  expect(await item('sweater-wufeng')).toMatchObject({ star: 0, canStar: false });
  await tap(page, (await item('ex-tieya')).icon);
  await page.waitForFunction(() => window.__WGZ__?.gear?.starPanel?.gearId === 'ex-tieya');
  await tap(page, (await wgz(page)).gear!.starPanel!.up);
  await page.waitForFunction(() => window.__WGZ__?.gear?.starPanel?.star === 1);
  expect((await wgz(page)).gear!.starPanel!.ok).toBe(false);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/gear-star-exclusive.png` });
  // 點視窗外面關掉
  await page.touchscreen.tap(20, 380);
  await page.waitForFunction(() => window.__WGZ__?.gear?.starPanel === null);

  // 有存檔：重新整理後星數還在
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  await page.reload();
  await waitScene(page, 'LobbyScene');
  await tap(page, (await wgz(page)).lobby!.buttons.bag);
  await waitScene(page, 'GearScene');
  s = (await wgz(page)).gear!;
  expect(s.items.filter((i) => i.star > 0).map((i) => [i.id, i.star])).toEqual(
    expect.arrayContaining([
      ['boxing-quanquan', 2],
      ['mitt-taojiaoqing', 1],
      ['ex-tieya', 1],
    ]),
  );
  expect(s.stats.attack).toBe(before.attack + 6);
});
