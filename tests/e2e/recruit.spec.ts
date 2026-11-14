import { expect, test, type Page } from '@playwright/test';
import { openLobby, tap, waitScene, wgz, type R } from './helpers';

const STARTERS = ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'];

/** 把 Math.random 換成固定種子的亂數，抽卡結果每次跑都一樣，截圖才穩定 */
async function seedRandom(page: Page, seed: number) {
  await page.addInitScript((s) => {
    let a = s >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, seed);
}

async function openRecruit(page: Page, query = '') {
  await openLobby(page, query);
  await tap(page, (await wgz(page)).lobby!.buttons.recruit);
  await waitScene(page, 'RecruitScene');
}

/** 按一次召募，等結果換新、卡片跳完 */
async function pullOnce(page: Page, which: 'one' | 'ten') {
  const before = (await wgz(page)).recruit!.pulls;
  await tap(page, (await wgz(page)).recruit!.buttons[which]);
  await page.waitForFunction(
    (n) =>
      (window.__WGZ__?.recruit?.pulls ?? 0) > n && window.__WGZ__?.recruit?.revealing === false,
    before,
  );
  return (await wgz(page)).recruit!;
}

const savedState = (page: Page) =>
  page.evaluate(() => JSON.parse(window.localStorage.getItem('wgz-save')!).state);

test('召募：單抽與十連，新狗加入、重複換碎片，到訓練場升星，重開還在', async ({ page }) => {
  await seedRandom(page, 20261113);
  await openRecruit(page);
  let r = (await wgz(page)).recruit!;
  expect(r).toMatchObject({ pulls: 0, toPity: 50, owned: 5, total: 19, results: [] });
  for (const b of [r.buttons.one, r.buttons.ten]) {
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(844);
    expect(b.y + b.height).toBeLessThanOrEqual(390);
    expect(b.height).toBeGreaterThanOrEqual(48);
  }
  await page.screenshot({ path: 'artifacts/screenshots/landscape/recruit.png' });

  // 單抽
  r = await pullOnce(page, 'one');
  expect(r.pulls).toBe(1);
  expect(r.results).toHaveLength(1);
  let owned = [...STARTERS];
  const shards: Record<string, number> = {};
  const track = (results: typeof r.results) => {
    for (const it of results) {
      expect(it.isNew).toBe(!owned.includes(it.dogId));
      expect(it.shards).toBe(it.isNew ? 0 : 10);
      if (it.isNew) owned = [...owned, it.dogId];
      else shards[it.dogId] = (shards[it.dogId] ?? 0) + 10;
    }
  };
  track(r.results);
  expect(r.owned).toBe(owned.length);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/recruit-single.png' });

  // 十連：剛好 10 隻，至少一隻 SR 以上，卡片都在畫面內
  r = await pullOnce(page, 'ten');
  expect(r.pulls).toBe(11);
  expect(r.results).toHaveLength(10);
  expect(r.results.some((it) => it.rarity === 'SR' || it.rarity === 'SSR')).toBe(true);
  for (const c of r.results) {
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.x + c.width).toBeLessThanOrEqual(844);
    expect(c.y + c.height).toBeLessThanOrEqual(390);
  }
  track(r.results);
  expect(r.owned).toBe(owned.length);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/recruit-ten.png' });

  // 再抽幾次十連，直到手上有重複換來的碎片
  for (let i = 0; i < 5 && Object.keys(shards).length === 0; i++) {
    r = await pullOnce(page, 'ten');
    track(r.results);
  }
  expect(Object.keys(shards).length).toBeGreaterThan(0);
  expect(r.toPity).toBeGreaterThanOrEqual(1);
  expect(r.toPity).toBeLessThanOrEqual(50);

  // 存檔裡有新狗、碎片與召募紀錄
  const st = await savedState(page);
  expect(st.owned).toEqual(owned);
  expect(st.shards).toEqual(shards);
  expect(st.gacha.pulls).toBe(r.pulls);
  for (const id of owned) expect(st.dogs[id]).toBeTruthy();

  // 組隊畫面：新狗變成擁有
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  await tap(page, (await wgz(page)).lobby!.buttons.team);
  await waitScene(page, 'TeamScene');
  const team = (await wgz(page)).team!;
  expect(team.owned).toBe(owned.length);
  expect(
    team.dogs
      .filter((d) => d.owned)
      .map((d) => d.id)
      .sort(),
  ).toEqual([...owned].sort());
  await page.screenshot({ path: 'artifacts/screenshots/landscape/recruit-team.png' });
  await tap(page, team.dogs[0]);
  await page.waitForFunction(() => !!window.__WGZ__?.team?.panel);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/recruit-dog-info.png' });
  await tap(page, { x: 0, y: 380, width: 844, height: 6 });
  await page.waitForFunction(() => window.__WGZ__?.team?.panel === null);

  // 訓練場：有碎片的狗可以升星
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  await tap(page, (await wgz(page)).lobby!.buttons.train);
  await waitScene(page, 'TrainingScene');
  let t = (await wgz(page)).training!;
  expect(t.rows).toHaveLength(owned.length);
  for (const row of t.rows) {
    expect(row.star).toMatchObject({
      star: 1,
      cost: 10,
      shards: shards[row.id] ?? 0,
      enabled: (shards[row.id] ?? 0) >= 10,
    });
    expect(row.levelCap).toBe(60);
    expect(row.star.x).toBeGreaterThanOrEqual(row.drill.defense.x + row.drill.defense.width);
    expect(row.star.x + row.star.width).toBeLessThanOrEqual(row.x + row.width);
  }
  const target = t.rows.find((row) => row.star.enabled)!;
  expect(target).toBeTruthy();
  // 捲到看得到那一列再按
  const inView = (b: R) => b.y >= t.list.y && b.y + b.height <= t.list.y + t.list.height;
  if (!inView(target.star)) {
    await page.mouse.move(195, 400);
    await page.mouse.wheel(0, target.star.y - t.list.y - 200);
    await page.waitForTimeout(200);
    t = (await wgz(page)).training!;
  }
  const before = t.rows.find((row) => row.id === target.id)!;
  expect(inView(before.star)).toBe(true);
  // 沒碎片的按了沒反應
  const none = t.rows.find((row) => !row.star.enabled && inView(row.star));
  if (none) {
    await tap(page, none.star);
    await page.waitForTimeout(150);
    expect((await wgz(page)).training!.rows.find((row) => row.id === none.id)!.star.star).toBe(1);
  }
  await page.screenshot({ path: 'artifacts/screenshots/landscape/star-before.png' });
  await tap(page, before.star);
  await page.waitForFunction(
    (id) => window.__WGZ__?.training?.rows.find((row) => row.id === id)?.star.star === 2,
    target.id,
  );
  const after = (await wgz(page)).training!.rows.find((row) => row.id === target.id)!;
  expect(after.star).toMatchObject({ star: 2, cost: 20, shards: before.star.shards - 10 });
  expect(after.levelCap).toBe(70);
  expect(after.attack).toBeGreaterThan(before.attack);
  expect(after.defense).toBeGreaterThan(before.defense);
  expect(after.power).toBe(after.attack + after.defense);
  expect(after.level).toBe(before.level);
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/star-up.png' });

  // 重新整理：狗、星數、碎片都還在
  await page.reload();
  await waitScene(page, 'LobbyScene');
  const again = await savedState(page);
  expect(again.owned).toEqual(owned);
  expect(again.dogs[target.id].star).toBe(2);
  expect(again.shards[target.id] ?? 0).toBe(before.star.shards - 10);
  expect(again.gacha.pulls).toBe(r.pulls);
});

test('召募：連抽 50 次以內一定有 SSR', async ({ page }) => {
  await seedRandom(page, 7);
  await openRecruit(page);
  const seen: string[] = [];
  let gotSSR = false;
  for (let i = 0; i < 5; i++) {
    const r = await pullOnce(page, 'ten');
    for (const it of r.results) seen.push(it.dogId);
    gotSSR ||= r.results.some((it) => it.rarity === 'SSR');
    expect(r.toPity).toBeLessThanOrEqual(50);
  }
  expect(gotSSR).toBe(true);
  expect(seen).toHaveLength(50);
});

test.describe('手機橫放', () => {
  const W = 844;
  const H = 390;
  test.use({ viewport: { width: W, height: H } });

  test('召募橫式：看板在左、結果在右，十連的卡片都在畫面內', async ({ page }) => {
    await seedRandom(page, 20261113);
    await openRecruit(page);
    let r = (await wgz(page)).recruit!;
    for (const b of [r.buttons.one, r.buttons.ten]) {
      expect(b.x + b.width).toBeLessThanOrEqual(W);
      expect(b.y + b.height).toBeLessThanOrEqual(H);
    }
    await page.screenshot({ path: 'artifacts/screenshots/landscape/recruit.png' });
    r = await pullOnce(page, 'ten');
    expect(r.results).toHaveLength(10);
    for (const c of r.results) {
      expect(c.x).toBeGreaterThan(r.buttons.ten.x + r.buttons.ten.width);
      expect(c.x + c.width).toBeLessThanOrEqual(W);
      expect(c.y).toBeGreaterThanOrEqual(56);
      expect(c.y + c.height).toBeLessThanOrEqual(H);
    }
    await page.screenshot({ path: 'artifacts/screenshots/landscape/recruit-ten.png' });
    r = await pullOnce(page, 'one');
    expect(r.results).toHaveLength(1);

    // 訓練場橫式：升星按鈕在卡片內
    await tap(page, (await wgz(page)).backButton!);
    await waitScene(page, 'LobbyScene');
    await tap(page, (await wgz(page)).lobby!.buttons.train);
    await waitScene(page, 'TrainingScene');
    for (const row of (await wgz(page)).training!.rows) {
      expect(row.star.x + row.star.width).toBeLessThanOrEqual(row.x + row.width);
      expect(row.star.x).toBeGreaterThanOrEqual(row.drill.defense.x + row.drill.defense.width);
    }
    await page.screenshot({ path: 'artifacts/screenshots/landscape/star.png' });
  });
});
