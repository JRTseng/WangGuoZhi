import { expect, test, type Page } from '@playwright/test';
import { openLobby, patchSave, tap, waitScene, wgz } from './helpers';

const W = 844;
const H = 390;
const quest = async (page: Page) => (await wgz(page)).quest!;

async function openQuests(page: Page) {
  await tap(page, (await wgz(page)).lobby!.buttons.quest);
  await waitScene(page, 'QuestScene');
}

async function switchTab(page: Page, tab: 'main' | 'daily' | 'weekly' | 'feat') {
  await tap(page, (await quest(page)).tabs[tab]);
  await page.waitForFunction((t) => window.__WGZ__?.quest?.tab === t, tab);
}

test('任務：主線、每日、成就三個分頁，完成領獎、一鍵全部領取，主頁有紅點', async ({ page }) => {
  await openLobby(page, '?fast=1');
  // 新遊戲沒有獎勵可領，主頁「任務」不亮紅點
  await page.waitForFunction(() => window.__WGZ__?.lobby?.questReady === 0);
  await openQuests(page);

  let q = await quest(page);
  expect(q.tab).toBe('main');
  expect(q.claimAll.count).toBe(0);
  expect(q.rows).toHaveLength(10);
  expect(q.rows[0]).toMatchObject({ id: 'main-luoyepo-mid', progress: 0, target: 3, done: false });
  for (const r of q.rows) {
    expect(r.x + r.width).toBeLessThanOrEqual(W);
    expect(r.y + r.height).toBeLessThanOrEqual(H);
    expect(r.button.height).toBeGreaterThanOrEqual(40);
    expect(r.button.x + r.button.width).toBeLessThanOrEqual(r.x + r.width);
  }
  await page.screenshot({ path: 'artifacts/screenshots/landscape/quest-main.png' });

  await switchTab(page, 'feat');
  q = await quest(page);
  expect(q.rows).toHaveLength(8);
  expect(q.rows.find((r) => r.id === 'feat-dogs-1')).toMatchObject({ progress: 5, target: 8 });
  await page.screenshot({ path: 'artifacts/screenshots/landscape/quest-feat.png' });

  // 還沒完成的主線按「前往」直接去出征地圖
  await switchTab(page, 'main');
  await tap(page, (await quest(page)).rows[0].button);
  await waitScene(page, 'CampaignScene');
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');

  // 把存檔改成「打到第 1 章第 3 關、今天出征 3 次打贏 2 場、抽過 12 次、累計贏 12 場」
  await patchSave(page, {
    cleared: ['luoyepo-1', 'luoyepo-2', 'luoyepo-3'],
    gacha: { pulls: 12, sinceSSR: 12 },
    quests: { claimed: [], wins: 12, daily: { counts: { battle: 3, win: 2 }, claimed: [] } },
  });
  // 主線 1 ＋ 每日 2 ＋ 成就 2（召募 10 次、打贏 10 場）
  await page.waitForFunction(() => window.__WGZ__?.lobby?.questReady === 5);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/quest-lobby-dot.png' });
  await openQuests(page);
  q = await quest(page);
  expect(q.tab).toBe('main');
  expect(q.tabs.main.count).toBe(1);
  expect(q.tabs.daily.count).toBe(2);
  expect(q.tabs.feat.count).toBe(2);
  expect(q.claimAll.count).toBe(5);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/quest-main-ready.png' });

  // 領主線：糧草 +560、骨頭幣 +25，換下一個主線
  const before = (await wgz(page)).resources!;
  expect(q.rows[0]).toMatchObject({ id: 'main-luoyepo-mid', done: true, food: 560, bones: 25 });
  await tap(page, q.rows[0].button);
  await page.waitForFunction(() => window.__WGZ__?.quest?.rows[0].id === 'main-luoyepo-boss');
  const res = (await wgz(page)).resources!;
  expect(res).toEqual({ food: before.food + 560, bones: before.bones + 25 });
  expect((await quest(page)).tabs.main.count).toBe(0);

  // 每日：出征、打贏可以領；召募還沒做，按「前往」去召募抽一次
  await switchTab(page, 'daily');
  q = await quest(page);
  expect(q.rows.map((r) => r.id)).toEqual([
    'daily-battle',
    'daily-win',
    'daily-drill',
    'daily-pull',
    'daily-all',
  ]);
  expect(q.rows.map((r) => r.done)).toEqual([true, true, false, false, false]);
  expect(q.rows[4]).toMatchObject({ progress: 2, target: 3 });
  await page.screenshot({ path: 'artifacts/screenshots/landscape/quest-daily.png' });
  const pull = q.rows.find((r) => r.id === 'daily-pull')!;
  expect(pull.go).toBe('RecruitScene');
  await tap(page, pull.button);
  await waitScene(page, 'RecruitScene');
  await tap(page, (await wgz(page)).recruit!.buttons.one);
  await page.waitForFunction(
    () => window.__WGZ__?.recruit?.pulls === 13 && window.__WGZ__?.recruit?.revealing === false,
  );
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  // 召募完成，「完成 3 個每日任務」也跟著達成：每日 4 ＋ 成就 2
  await page.waitForFunction(() => window.__WGZ__?.lobby?.questReady === 6);

  // 進任務會先開有獎勵的分頁；按「全部領取」一次領完
  await openQuests(page);
  q = await quest(page);
  expect(q.tab).toBe('daily');
  expect(q.rows.find((r) => r.id === 'daily-all')).toMatchObject({ progress: 3, done: true });
  expect(q.claimAll.count).toBe(6);
  const sum = [
    ...q.rows.filter((r) => r.done),
    // 成就第一段：糧草 500、骨頭幣 20，兩個
    { food: 500, bones: 20 },
    { food: 500, bones: 20 },
  ].reduce((a, r) => ({ food: a.food + r.food, bones: a.bones + r.bones }), { food: 0, bones: 0 });
  await tap(page, q.claimAll);
  await page.waitForFunction(() => window.__WGZ__?.quest?.claimAll.count === 0);
  q = await quest(page);
  expect(q.rows.filter((r) => r.claimed).map((r) => r.id)).toEqual([
    'daily-battle',
    'daily-win',
    'daily-pull',
    'daily-all',
  ]);
  const after = (await wgz(page)).resources!;
  expect(after).toEqual({ food: res.food + sum.food, bones: res.bones + sum.bones });
  await page.screenshot({ path: 'artifacts/screenshots/landscape/quest-claimed.png' });

  // 成就領完一段換下一段
  await switchTab(page, 'feat');
  q = await quest(page);
  expect(q.rows.find((r) => r.id === 'feat-pulls-2')).toMatchObject({ progress: 13, target: 50 });
  expect(q.rows.find((r) => r.id === 'feat-wins-2')).toMatchObject({ progress: 12, target: 50 });

  // 領過的重開還在，主頁紅點熄掉
  await page.reload();
  await waitScene(page, 'LobbyScene');
  await page.waitForFunction(() => window.__WGZ__?.lobby?.questReady === 0);
  const saved = await page.evaluate(
    () => JSON.parse(window.localStorage.getItem('wgz-save')!).state.quests,
  );
  expect(saved.claimed.sort()).toEqual(['feat-pulls-1', 'feat-wins-1', 'main-luoyepo-mid']);
  expect(saved.daily.claimed).toHaveLength(4);
});

test('任務：特訓一次，每日任務的次數會跟著加', async ({ page }) => {
  await openLobby(page, '?fast=1');
  // 特訓一次
  await tap(page, (await wgz(page)).lobby!.buttons.train);
  await waitScene(page, 'TrainingScene');
  const row = (await wgz(page)).training!.rows[0];
  await tap(page, row.drill.attack);
  await page.waitForFunction(
    () =>
      JSON.parse(window.localStorage.getItem('wgz-save')!).state.quests.daily.counts.drill === 1,
  );
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  await openQuests(page);
  await switchTab(page, 'daily');
  const q = await quest(page);
  expect(q.rows.find((r) => r.id === 'daily-drill')).toMatchObject({ progress: 1, target: 3 });
  expect(q.rows.find((r) => r.id === 'daily-battle')).toMatchObject({ progress: 0, target: 3 });
});

test('每週任務：次數累積一整週，摸摸角色也算，完成 5 個有加碼獎勵', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await openQuests(page);
  await switchTab(page, 'weekly');
  let q = await quest(page);
  // 登天塔還沒開放（第三章後），不列那一個
  expect(q.rows.map((r) => r.id)).toEqual([
    'weekly-battle',
    'weekly-win',
    'weekly-drill',
    'weekly-pull',
    'weekly-pet',
    'weekly-days',
    'weekly-all',
  ]);
  expect(q.rows.every((r) => !r.done)).toBe(true);
  for (const t of Object.values(q.tabs)) {
    expect(t.height).toBeGreaterThanOrEqual(44);
    expect(t.y + t.height).toBeLessThanOrEqual(q.claimAll.y);
  }
  await page.screenshot({ path: 'artifacts/screenshots/landscape/quest-weekly.png' });
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');

  // 把存檔改成「這週出征 30、打贏 20、特訓 15、召募 10、摸了 9 次」，登天塔也開了、這週爬到第 4 層
  const week = await page.evaluate(() => {
    const d = new Date(Date.now() - 5 * 3600_000);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const two = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
  });
  const cleared = ['luoyepo', 'zhulindu', 'xuelingguan'].flatMap((r) =>
    [1, 2, 3, 4, 5].map((n) => `${r}-${n}`),
  );
  const ids = await page.evaluate(
    () => JSON.parse(window.localStorage.getItem('wgz-save')!).state.cleared as string[],
  );
  expect(ids).toEqual([]);
  await patchSave(page, {
    cleared,
    tower: { week, floor: 4, last: 0, best: 4, gear: [] },
    quests: {
      claimed: [],
      wins: 0,
      daily: { counts: {}, claimed: [] },
      weekly: {
        week,
        counts: { battle: 30, win: 20, drill: 15, pull: 10, pet: 9 },
        claimed: [],
      },
    },
  });
  const ready = (await wgz(page)).lobby!.questReady;
  await openQuests(page);
  await switchTab(page, 'weekly');
  q = await quest(page);
  expect(q.rows).toHaveLength(8);
  expect(q.tabs.weekly.count).toBe(4);
  expect(q.rows.find((r) => r.id === 'weekly-tower')).toMatchObject({
    progress: 4,
    target: 10,
    go: 'TowerScene',
  });
  expect(q.rows.find((r) => r.id === 'weekly-pet')).toMatchObject({ progress: 9, go: 'HomeScene' });
  expect(q.rows.find((r) => r.id === 'weekly-all')).toMatchObject({ progress: 4, done: false });
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');

  // 在主頁摸一下主頁角色：第 10 次，「摸摸角色」完成，加碼任務也跟著達成
  await tap(page, (await wgz(page)).lobby!.bond!.hit);
  await page.waitForFunction((n) => window.__WGZ__?.lobby?.questReady === n + 2, ready ?? 0);
  await openQuests(page);
  await switchTab(page, 'weekly');
  q = await quest(page);
  expect(q.tabs.weekly.count).toBe(6);
  expect(q.rows.find((r) => r.id === 'weekly-all')).toMatchObject({ progress: 5, done: true });
  await page.screenshot({ path: 'artifacts/screenshots/landscape/quest-weekly-ready.png' });

  // 領加碼任務：骨頭幣 +100
  const before = (await wgz(page)).resources!;
  await tap(page, q.rows.find((r) => r.id === 'weekly-all')!.button);
  await page.waitForFunction(() => window.__WGZ__?.quest?.tabs.weekly.count === 5);
  expect((await wgz(page)).resources).toEqual({ food: before.food, bones: before.bones + 100 });

  // 重開還在
  await page.reload();
  await waitScene(page, 'LobbyScene');
  const saved = await page.evaluate(
    () => JSON.parse(window.localStorage.getItem('wgz-save')!).state.quests.weekly,
  );
  expect(saved).toMatchObject({ week, claimed: ['weekly-all'] });
  expect(saved.counts.pet).toBe(10);
});
