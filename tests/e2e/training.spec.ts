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
  // 等級高的排前面
  for (let i = 1; i < rows.length; i++)
    expect(rows[i].level).toBeLessThanOrEqual(rows[i - 1].level);
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
