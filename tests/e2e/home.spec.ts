import { expect, test } from '@playwright/test';
import { drag, openLobby, patchSave, tap, waitScene, wgz } from './helpers';

const SHOTS = 'artifacts/screenshots/home';
const home = async (page: Parameters<typeof wgz>[0]) => (await wgz(page)).home!;

test('我的家：主頁腳印按鈕進來，屋內與庭院、住戶、家具、風格', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await tap(page, (await wgz(page)).lobby!.buttons.home);
  await waitScene(page, 'HomeScene');
  let h = await home(page);
  expect(h.area).toBe('indoor');
  expect(h.style).toBe('meadow');
  // 沒選過住戶：先住目前的隊伍
  expect(h.residents.length).toBeGreaterThan(0);
  expect(h.residents.length).toBeLessThanOrEqual(5);
  // 汪國一開始屋內沒有貓跳台
  expect(h.pieces.map((p) => p.id)).toContain('sofa');
  expect(h.pieces.map((p) => p.id)).not.toContain('cattree');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/indoor.png` });

  // 住戶：五隻都住進來
  await tap(page, h.buttons.residents);
  await page.waitForFunction(() => window.__WGZ__?.home?.modal?.kind === 'residents');
  for (;;) {
    const m = (await home(page)).modal!;
    const off = m.cells.find((c) => !c.on);
    if (!off || m.cells.filter((c) => c.on).length >= 5) break;
    await tap(page, off);
    await page.waitForFunction(
      (id) => window.__WGZ__?.home?.modal?.cells.find((c) => c.id === id)?.on === true,
      off.id,
    );
  }
  await page.screenshot({ path: `${SHOTS}/modal-residents.png` });
  await tap(page, (await home(page)).modal!.close);
  await page.waitForFunction(() => window.__WGZ__?.home?.residents.length === 5);

  // 家具：把貓跳台擺出來
  await tap(page, (await home(page)).buttons.furniture);
  await page.waitForFunction(() => window.__WGZ__?.home?.modal?.kind === 'furniture');
  let m = (await home(page)).modal!;
  expect(m.cells).toHaveLength(25);
  await tap(
    page,
    m.cells.find((c) => c.id === 'cattree')!,
  );
  await page.waitForFunction(
    () => window.__WGZ__?.home?.modal?.cells.find((c) => c.id === 'cattree')?.on === true,
  );
  await page.screenshot({ path: `${SHOTS}/modal-furniture.png` });
  await tap(page, (await home(page)).modal!.close);
  await page.waitForFunction(
    () =>
      !window.__WGZ__?.home?.modal && window.__WGZ__?.home?.pieces.some((p) => p.id === 'cattree'),
  );

  // 拖家具：貓跳台往左下搬，位置會存起來
  h = await home(page);
  const tree = h.pieces.find((p) => p.id === 'cattree')!;
  const to = { x: tree.x - 200, y: tree.y + 70, width: tree.width, height: tree.height };
  await drag(page, tree, to);
  await page.waitForFunction(
    (x) =>
      Math.abs((window.__WGZ__?.home?.pieces.find((p) => p.id === 'cattree')?.x ?? 0) - x) < 30,
    to.x,
  );
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('wgz-save')!).state.home.placed.cattree,
  );
  expect(saved.x).toBeLessThan(0.7);

  // 風格：十五種，換成雪地木屋
  await tap(page, (await home(page)).buttons.style);
  await page.waitForFunction(() => window.__WGZ__?.home?.modal?.kind === 'style');
  m = (await home(page)).modal!;
  expect(m.cells).toHaveLength(15);
  await page.screenshot({ path: `${SHOTS}/modal-style.png` });
  await tap(
    page,
    m.cells.find((c) => c.id === 'snow')!,
  );
  await page.waitForFunction(() => window.__WGZ__?.home?.style === 'snow');
  await tap(page, (await home(page)).modal!.close);
  await page.waitForFunction(() => !window.__WGZ__?.home?.modal);

  // 去庭院：泳池、飛盤、球球
  await tap(page, (await home(page)).buttons.area);
  await page.waitForFunction(() => window.__WGZ__?.home?.area === 'yard');
  h = await home(page);
  for (const id of ['pool', 'frisbee', 'ball']) expect(h.pieces.map((p) => p.id)).toContain(id);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/yard-snow.png` });

  // 回主頁再進來：場景、風格、住戶都記得
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  await page.reload();
  await waitScene(page, 'LobbyScene');
  await tap(page, (await wgz(page)).lobby!.buttons.home);
  await waitScene(page, 'HomeScene');
  h = await home(page);
  expect(h.area).toBe('yard');
  expect(h.style).toBe('snow');
  expect(h.residents).toHaveLength(5);
});

test('我的家：喵國是貓腳印，屋內一開始就有貓跳台', async ({ page }) => {
  await openLobby(page, '?fast=1&faction=cat');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/lobby-cat.png` });
  await tap(page, (await wgz(page)).lobby!.buttons.home);
  await waitScene(page, 'HomeScene');
  const h = await home(page);
  expect(h.pieces.map((p) => p.id)).toContain('cattree');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/indoor-cat.png` });
});

/** 點一隻住在家裡的角色，直到下面的互動卡打開（牠們會走動，沒點到就再點一次） */
async function petSomeone(page: Parameters<typeof wgz>[0]) {
  for (let i = 0; i < 40; i += 1) {
    const pets = (await home(page)).pets;
    const p = pets.find((x) => !x.moving) ?? pets[0];
    await tap(page, p, 0.5, 0.45);
    const opened = await page
      .waitForFunction(() => !!window.__WGZ__?.home?.card, null, { timeout: 700 })
      .then(() => true)
      .catch(() => false);
    if (opened) return (await home(page)).card!;
  }
  throw new Error('點不到家裡的角色');
}

test('我的家：點角色摸摸牠、送零食加好感度，一天最多送三次（T044）', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await patchSave(page, { snacks: { small: 5, mid: 1 } });
  const saved = () =>
    page.evaluate(() => JSON.parse(window.localStorage.getItem('wgz-save')!).state);
  await tap(page, (await wgz(page)).lobby!.buttons.home);
  await waitScene(page, 'HomeScene');
  const h = await home(page);
  expect(h.card).toBeNull();
  expect(h.pets.length).toBe(h.residents.length);
  for (const p of h.pets) {
    expect(p.width).toBeGreaterThanOrEqual(44);
    expect(p.height).toBeGreaterThanOrEqual(44);
    expect(p).toMatchObject({ level: 0, canPet: true });
  }

  // 點一下：摸摸 +10，升到 1 級，下面跳出互動卡
  let card = await petSomeone(page);
  const id = card.dogId;
  expect(card).toMatchObject({ level: 1, points: 10, left: 3 });
  expect(card.line.length).toBeGreaterThan(0);
  expect(card.gifts.map((g) => [g.id, g.count, g.ok])).toEqual([
    ['small', 5, true],
    ['mid', 1, true],
    ['big', 0, false],
  ]);
  for (const r of [...card.gifts, card.close]) {
    expect(r.width).toBeGreaterThanOrEqual(44);
    expect(r.height).toBeGreaterThanOrEqual(44);
  }
  expect((await home(page)).pets.find((p) => p.id === id)).toMatchObject({
    level: 1,
    canPet: false,
  });
  await page.screenshot({ path: `${SHOTS}/pet-card.png` });

  // 送小肉乾：+5，零食少一個，今天剩兩次
  await tap(page, card.gifts[0]);
  await page.waitForFunction(() => window.__WGZ__?.home?.card?.points === 15);
  card = (await home(page)).card!;
  expect(card).toMatchObject({ left: 2 });
  expect(card.gifts[0].count).toBe(4);
  await page.screenshot({ path: `${SHOTS}/pet-gift.png` });

  // 沒有的零食送不出去，會說為什麼
  await tap(page, card.gifts[2]);
  await page.waitForFunction(() => window.__WGZ__?.home?.note.includes('沒有了'));
  expect((await home(page)).card!.points).toBe(15);

  // 香烤肉排 +12、再一個小肉乾 +5：今天三次用完
  await tap(page, card.gifts[1]);
  await page.waitForFunction(() => window.__WGZ__?.home?.card?.points === 27);
  await tap(page, card.gifts[0]);
  await page.waitForFunction(() => window.__WGZ__?.home?.card?.points === 32);
  card = (await home(page)).card!;
  expect(card).toMatchObject({ level: 2, left: 0 });
  expect(card.gifts.every((g) => !g.ok)).toBe(true);
  await tap(page, card.gifts[0]);
  await page.waitForFunction(() => window.__WGZ__?.home?.note.includes('明天再送'));
  expect((await home(page)).card!.gifts[0].count).toBe(3);
  await page.screenshot({ path: `${SHOTS}/pet-full.png` });

  // 存檔記得好感度、今天摸過誰、送過幾次
  await expect.poll(async () => (await saved()).bond.points[id], { timeout: 10_000 }).toBe(32);
  const st = await saved();
  expect(st.bond.petted).toEqual([id]);
  expect(st.bond.gifted).toEqual({ [id]: 3 });
  expect(st.snacks).toMatchObject({ small: 3, mid: 0 });

  // 關掉互動卡
  await tap(page, card.close);
  await page.waitForFunction(() => window.__WGZ__?.home?.card === null);
});
