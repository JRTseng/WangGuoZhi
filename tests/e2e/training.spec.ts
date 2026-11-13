import { expect, test, type Page } from '@playwright/test';
import { openLobby, startBattle, tap, waitScene, wgz, type R } from './helpers';

const ALL = ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'];

/** 五隻全上打第 1 關，等戰鬥播完到結算 */
async function winFirstStage(page: Page) {
  await openLobby(page, '?fast=1');
  await startBattle(page, 0, ALL);
  await waitScene(page, 'BattleScene');
  await page.waitForFunction(() => window.__WGZ__?.battle?.phase === 'result');
  await page.waitForFunction(() => !!window.__WGZ__?.growth);
}

test('升級：打完拿經驗、1 級的狗連升到 3 級，訓練場與角色資訊看得到', async ({ page }) => {
  await winFirstStage(page);
  let s = await wgz(page);
  expect(s.result).toEqual({ food: 120, bones: 5, win: true });
  const growth = s.growth!;
  expect(growth.map((g) => g.dogId)).toEqual(ALL);
  for (const g of growth) expect(g.exp).toBe(90);
  // 第 1 關 90 經驗：1 級的小算、阿白連升兩級（20 + 57），3 級的大耳（需要 104）還不夠
  const by = (id: string) => growth.find((g) => g.dogId === id)!;
  expect(by('daer')).toMatchObject({ fromLevel: 3, toLevel: 3 });
  for (const id of ['xiaosuan', 'abai']) {
    const g = by(id);
    expect(g).toMatchObject({ fromLevel: 1, toLevel: 3 });
    expect(g.attack.fixed + g.defense.fixed).toBe(10);
    for (const b of [g.attack.bonus, g.defense.bonus]) {
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(4);
    }
  }
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/level-up.png' });

  // 關掉結算 → 過關劇情 → 主頁 → 訓練場
  await tap(page, { x: 0, y: 830, width: 390, height: 10 });
  await waitScene(page, 'StoryScene');
  await tap(page, (await wgz(page)).story!.skip!);
  await waitScene(page, 'LobbyScene');
  expect((await wgz(page)).growth ?? null).toBeNull();
  await tap(page, (await wgz(page)).lobby!.buttons.train);
  await waitScene(page, 'TrainingScene');
  s = await wgz(page);
  const rows = s.training!.rows;
  expect(rows).toHaveLength(5);
  for (const r of rows) {
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(390);
    expect(r.y + r.height).toBeLessThanOrEqual(844);
  }
  // 預設依稀有度排（R 的大耳、黑旋、長鬚在 N 的小算、阿白前面），同稀有度等級高的在前
  expect(s.training!.sort).toBe('rarity');
  expect(
    rows
      .map((r) => r.id)
      .slice(3)
      .sort(),
  ).toEqual(['abai', 'xiaosuan']);
  const abai = rows.find((r) => r.id === 'abai')!;
  const g = by('abai');
  expect(abai).toMatchObject({ level: 3, exp: 13 });
  expect(abai.attack).toBe(34 + g.attack.fixed + g.attack.bonus);
  expect(abai.defense).toBe(36 + g.defense.fixed + g.defense.bonus);
  expect(abai.power).toBe(abai.attack + abai.defense);
  expect(rows.find((r) => r.id === 'daer')).toMatchObject({ level: 3, exp: 90, expNeed: 104 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/training.png' });

  // 返回主頁 → 組隊 → 角色資訊也顯示新的等級與經驗
  await tap(page, s.backButton!);
  await waitScene(page, 'LobbyScene');
  await tap(page, (await wgz(page)).lobby!.buttons.team);
  await waitScene(page, 'TeamScene');
  await tap(
    page,
    (await wgz(page)).team!.dogs.find((d) => d.id === 'abai')!,
  );
  await page.waitForFunction(() => window.__WGZ__?.team?.panel === 'abai');
  expect((await wgz(page)).team!.panelStats).toEqual({
    level: 3,
    exp: 13,
    expNeed: 104,
    power: abai.power,
    star: 1,
  });
  await page.screenshot({ path: 'artifacts/screenshots/portrait/dog-info-level.png' });
});

test('打輸也拿一半經驗', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await startBattle(page, 0, ['abai']);
  await waitScene(page, 'BattleScene');
  await page.waitForFunction(() => window.__WGZ__?.battle?.phase === 'result');
  const s = await wgz(page);
  expect(s.result!.win).toBe(false);
  expect(s.growth).toEqual([
    {
      dogId: 'abai',
      exp: 45,
      fromLevel: 1,
      toLevel: 2,
      attack: s.growth![0].attack,
      defense: s.growth![0].defense,
    },
  ]);
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/level-lose.png' });
});

test.describe('手機橫放', () => {
  const W = 844;
  const H = 390;
  test.use({ viewport: { width: W, height: H } });

  test('升級結算與訓練場橫式', async ({ page }) => {
    await winFirstStage(page);
    expect((await wgz(page)).growth).toHaveLength(5);
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'artifacts/screenshots/landscape/level-up.png' });

    await tap(page, { x: 0, y: 380, width: W, height: 6 });
    await waitScene(page, 'StoryScene');
    await tap(page, (await wgz(page)).story!.skip!);
    await waitScene(page, 'LobbyScene');
    await tap(page, (await wgz(page)).lobby!.buttons.train);
    await waitScene(page, 'TrainingScene');
    const t = (await wgz(page)).training!;
    expect(t.rows).toHaveLength(5);
    const inside = (r: R) => {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(W);
    };
    for (const r of t.rows) inside(r);
    // 兩欄
    expect(t.rows[1].y).toBe(t.rows[0].y);
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'artifacts/screenshots/landscape/training.png' });
    // 第 5 隻放不下可以捲動
    if (t.scrollMax > 0) {
      await page.mouse.move(W / 2, H / 2);
      await page.mouse.wheel(0, 400);
      await page.waitForFunction(() => (window.__WGZ__?.training?.scrollY ?? 0) > 0);
    }
  });
});

/** 從主頁進訓練場 */
async function openTraining(page: Page) {
  await openLobby(page, '?fast=1');
  await tap(page, (await wgz(page)).lobby!.buttons.train);
  await waitScene(page, 'TrainingScene');
}

const row = async (page: Page, id: string) =>
  (await wgz(page)).training!.rows.find((r) => r.id === id)!;

/** 按 n 次某隻狗的特訓按鈕，每次等畫面上的次數更新 */
async function drillTap(page: Page, id: string, stat: 'attack' | 'defense', n: number) {
  for (let i = 0; i < n; i++) {
    const before = await row(page, id);
    await tap(page, before.drill[stat]);
    await page.waitForFunction(
      ([dogId, s, count]) =>
        window.__WGZ__?.training?.rows.find((r) => r.id === dogId)?.drill[s as 'attack' | 'defense']
          .count ===
        (count as number) + 1,
      [id, stat, before.drill[stat].count] as const,
    );
  }
}

test('特訓：花糧草加攻防，練滿與糧草不足時不能按', async ({ page }) => {
  await openTraining(page);
  let t = (await wgz(page)).training!;
  expect(t.food).toBe(1200);
  for (const r of t.rows) {
    for (const b of [r.drill.attack, r.drill.defense]) {
      expect(b).toMatchObject({ count: 0, cost: 10, enabled: true });
      expect(b.x).toBeGreaterThanOrEqual(r.x);
      expect(b.x + b.width).toBeLessThanOrEqual(r.x + r.width);
      expect(b.y + b.height).toBeLessThanOrEqual(r.y + r.height);
      expect(b.height).toBeGreaterThanOrEqual(40);
    }
  }
  const order = t.rows.map((r) => r.id);
  const daer0 = await row(page, 'daer');

  // 攻擊特訓 3 次：10 + 20 + 30
  await drillTap(page, 'daer', 'attack', 3);
  let daer = await row(page, 'daer');
  expect(daer.attack).toBe(daer0.attack + 3);
  expect(daer.defense).toBe(daer0.defense);
  expect(daer.power).toBe(daer0.power + 3);
  expect(daer.level).toBe(daer0.level);
  expect(daer.drill.attack).toMatchObject({ count: 3, cost: 40, enabled: true });
  expect(daer.drill.defense).toMatchObject({ count: 0, cost: 10 });
  expect((await wgz(page)).training!.food).toBe(1140);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/drill.png' });

  // 大耳攻防都練滿：共 1100
  await drillTap(page, 'daer', 'attack', 7);
  await drillTap(page, 'daer', 'defense', 10);
  daer = await row(page, 'daer');
  expect(daer.attack).toBe(daer0.attack + 10);
  expect(daer.defense).toBe(daer0.defense + 10);
  expect(daer.drill.attack).toMatchObject({ count: 10, cost: 0, enabled: false });
  expect(daer.drill.defense).toMatchObject({ count: 10, cost: 0, enabled: false });
  expect((await wgz(page)).training!.food).toBe(100);
  // 滿了再按沒有反應
  await tap(page, daer.drill.attack);
  await page.waitForTimeout(150);
  expect((await wgz(page)).training!.food).toBe(100);
  expect((await row(page, 'daer')).attack).toBe(daer0.attack + 10);

  // 剩下的 100 給阿白練 4 次攻擊（10+20+30+40），糧草歸零後全部不能按
  await drillTap(page, 'abai', 'attack', 4);
  t = (await wgz(page)).training!;
  expect(t.food).toBe(0);
  for (const r of t.rows) {
    expect(r.drill.attack.enabled).toBe(false);
    expect(r.drill.defense.enabled).toBe(false);
  }
  const abai = await row(page, 'abai');
  expect(abai.drill.attack).toMatchObject({ count: 4, cost: 50 });
  await tap(page, abai.drill.attack);
  await page.waitForTimeout(150);
  expect((await row(page, 'abai')).drill.attack.count).toBe(4);
  // 特訓後順序不變
  expect(t.rows.map((r) => r.id)).toEqual(order);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/drill-maxed-no-food.png' });

  // 離開再回來還在；組隊畫面的戰力也一致
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  await tap(page, (await wgz(page)).lobby!.buttons.team);
  await waitScene(page, 'TeamScene');
  await tap(
    page,
    (await wgz(page)).team!.dogs.find((d) => d.id === 'daer')!,
  );
  await page.waitForFunction(() => window.__WGZ__?.team?.panel === 'daer');
  expect((await wgz(page)).team!.panelStats!.power).toBe(daer0.power + 20);
});

test.describe('手機橫放：特訓', () => {
  const W = 844;
  const H = 390;
  test.use({ viewport: { width: W, height: H } });

  test('橫式特訓，捲動後按鈕位置也對', async ({ page }) => {
    await openTraining(page);
    let t = (await wgz(page)).training!;
    for (const r of t.rows) {
      expect(r.drill.attack.x).toBeGreaterThanOrEqual(r.x);
      expect(r.drill.defense.x + r.drill.defense.width).toBeLessThanOrEqual(r.x + r.width);
    }
    await drillTap(page, t.rows[0].id, 'attack', 2);
    await drillTap(page, t.rows[1].id, 'defense', 1);
    await page.waitForTimeout(900);
    await page.screenshot({ path: 'artifacts/screenshots/landscape/drill.png' });

    // 捲到底，按最後一隻
    expect(t.scrollMax).toBeGreaterThan(0);
    await page.mouse.move(W / 2, H / 2);
    await page.mouse.wheel(0, 600);
    await page.waitForFunction(
      () => window.__WGZ__?.training?.scrollY === window.__WGZ__?.training?.scrollMax,
    );
    t = (await wgz(page)).training!;
    const last = t.rows[t.rows.length - 1];
    expect(last.drill.attack.y).toBeGreaterThanOrEqual(t.list.y);
    expect(last.drill.attack.y + last.drill.attack.height).toBeLessThanOrEqual(
      t.list.y + t.list.height,
    );
    await drillTap(page, last.id, 'attack', 1);
    expect((await row(page, last.id)).attack).toBe(last.attack + 1);
    expect((await wgz(page)).training!.food).toBe(1200 - 10 - 20 - 10 - 10);
    // 拖曳捲動不會誤觸特訓
    const box = (await page.locator('canvas').boundingBox())!;
    const b = (await row(page, last.id)).drill.defense;
    const sx = box.width / W;
    await page.mouse.move(box.x + (b.x + b.width / 2) * sx, box.y + (b.y + b.height / 2) * sx);
    await page.mouse.down();
    await page.mouse.move(box.x + (b.x + b.width / 2) * sx, box.y + (b.y + 80) * sx, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    expect((await row(page, last.id)).drill.defense.count).toBe(0);
  });
});

test('排序：點按鈕輪流換條件，重開遊戲還記得', async ({ page }) => {
  await openTraining(page);
  let t = (await wgz(page)).training!;
  expect(t.sort).toBe('rarity');
  // 按鈕在說明列裡、列表上面，不超出畫面
  expect(t.sortChip.x + t.sortChip.width).toBeLessThanOrEqual(390);
  expect(t.sortChip.y + t.sortChip.height).toBeLessThanOrEqual(t.list.y);

  // 稀有度 → 等級 → 戰力
  for (const sort of ['level', 'power'] as const) {
    await tap(page, t.sortChip);
    await page.waitForFunction((s) => window.__WGZ__?.training?.sort === s, sort);
    t = (await wgz(page)).training!;
    expect(t.rows).toHaveLength(5);
    for (let i = 1; i < t.rows.length; i++)
      expect(t.rows[i][sort]).toBeLessThanOrEqual(t.rows[i - 1][sort]);
  }
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/training-sort.png' });

  // → 可升星 → 定位：突擊的黑旋排第一
  await tap(page, t.sortChip);
  await page.waitForFunction(() => window.__WGZ__?.training?.sort === 'star');
  await tap(page, t.sortChip);
  await page.waitForFunction(() => window.__WGZ__?.training?.sort === 'role');
  t = (await wgz(page)).training!;
  expect(t.rows.map((r) => r.id)).toEqual(['heixuan', 'changxu', 'xiaosuan', 'abai', 'daer']);

  // 重開遊戲：沿用上次選的排序
  await openTraining(page);
  t = (await wgz(page)).training!;
  expect(t.sort).toBe('role');
  expect(t.rows[0].id).toBe('heixuan');
});
