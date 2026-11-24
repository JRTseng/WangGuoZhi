import { expect, test, type Page } from '@playwright/test';
import { openLobby, patchSave, tap, waitScene, wgz } from './helpers';

const W = 844;
const H = 390;
const SHOTS = 'artifacts/screenshots/codex';
const codex = async (page: Page) => (await wgz(page)).codex!;

async function openCodex(page: Page) {
  await tap(page, (await wgz(page)).lobby!.buttons.codex);
  await waitScene(page, 'CodexScene');
}

test('圖鑑：主頁進來，列出全部角色，點一下看資料，兩個陣營可以切', async ({ page }) => {
  await openLobby(page, '?fast=1');
  // 新遊戲沒有收集獎勵可以領，「圖鑑」不亮紅點
  await page.waitForFunction(() => window.__WGZ__?.lobby?.codexReady === 0);
  await page.screenshot({ path: `${SHOTS}/codex-lobby.png` });
  await openCodex(page);

  let c = await codex(page);
  expect(c.faction).toBe('dog');
  expect(c).toMatchObject({ owned: 5, total: 50 });
  expect(c.cells).toHaveLength(50);
  expect(
    c.cells
      .filter((x) => x.owned)
      .map((x) => x.id)
      .sort(),
  ).toEqual(['abai', 'changxu', 'daer', 'heixuan', 'xiaosuan'].sort());
  // 稀有度高的排前面
  expect(c.cells[0].rarity).toBe('SSR');
  expect(c.cells[49].rarity).toBe('N');
  for (const cell of c.cells) {
    expect(cell.x + cell.width).toBeLessThanOrEqual(W);
    expect(cell.y + cell.height).toBeLessThanOrEqual(H);
    expect(cell.width).toBeGreaterThanOrEqual(44);
    expect(cell.height).toBeGreaterThanOrEqual(44);
  }
  expect(c.claim.count).toBe(0);
  expect(c.milestones.map((m) => m.target)).toEqual([10, 20, 30, 40, 50]);
  await page.screenshot({ path: `${SHOTS}/codex-new.png` });

  // 點有的角色：看資料，按「關閉」收起來
  const mine = c.cells.find((x) => x.id === 'daer')!;
  await tap(page, mine);
  await page.waitForFunction(() => window.__WGZ__?.codex?.panel === 'daer');
  // 圖鑑的資料視窗先開「小故事」那一頁（T041），按右上角換成成長技能、再按換回來
  expect((await codex(page)).panelTab).toBe('story');
  await page.screenshot({ path: `${SHOTS}/codex-info-owned.png` });
  await tap(page, (await codex(page)).panelTabButton!);
  await page.waitForFunction(() => window.__WGZ__?.codex?.panelTab === 'skills');
  await page.screenshot({ path: `${SHOTS}/codex-info-skills.png` });
  await tap(page, (await codex(page)).panelTabButton!);
  await page.waitForFunction(() => window.__WGZ__?.codex?.panelTab === 'story');
  await tap(page, (await codex(page)).panelClose!);
  await page.waitForFunction(() => window.__WGZ__?.codex?.panel === null);

  // 點還沒有的角色：一樣看得到資料，點旁邊收起來
  const other = c.cells.find((x) => !x.owned)!;
  await tap(page, other);
  await page.waitForFunction((id) => window.__WGZ__?.codex?.panel === id, other.id);
  expect((await codex(page)).panelClose).toBeNull();
  // 換過頁會記著：剛才換回小故事，這隻也先開小故事（還沒有的角色只看到「？？？」）
  expect((await codex(page)).panelTab).toBe('story');
  await page.screenshot({ path: `${SHOTS}/codex-info-missing.png` });
  await tap(page, { x: 2, y: H - 6, width: 4, height: 4 });
  await page.waitForFunction(() => window.__WGZ__?.codex?.panel === null);

  // 切到喵國：50 隻貓，一隻都還沒有
  await tap(page, c.tabs.cat);
  await page.waitForFunction(() => window.__WGZ__?.codex?.faction === 'cat');
  c = await codex(page);
  expect(c).toMatchObject({ owned: 0, total: 50 });
  expect(c.cells).toHaveLength(50);
  await page.screenshot({ path: `${SHOTS}/codex-cat.png` });

  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
});

test('圖鑑：收集到 20 隻可以領前兩段獎勵，主頁有紅點，領過不能再領', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await openCodex(page);
  const ids = (await codex(page)).cells.map((x) => x.id);
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');

  // 把存檔改成有 20 隻狗（一開始的五隻加上另外 15 隻）
  const starters = ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'];
  // 挑稀有度低的：SR、SSR 會附送專屬裝備，裝備頁的收集獎勵就會跟著亮（T043）
  const owned = [...starters, ...ids.filter((id) => !starters.includes(id)).slice(-15)];
  await patchSave(page, { owned });
  await page.waitForFunction(() => window.__WGZ__?.lobby?.codexReady === 2);
  await page.screenshot({ path: `${SHOTS}/codex-lobby-dot.png` });

  await openCodex(page);
  let c = await codex(page);
  expect(c).toMatchObject({ owned: 20, total: 50 });
  expect(c.claim.count).toBe(2);
  expect(c.tabs.dog.count).toBe(2);
  expect(c.milestones.map((m) => m.done)).toEqual([true, true, false, false, false]);
  await page.screenshot({ path: `${SHOTS}/codex-ready.png` });

  const before = (await wgz(page)).resources!;
  await tap(page, c.claim);
  await page.waitForFunction(() => window.__WGZ__?.codex?.claim.count === 0);
  c = await codex(page);
  expect(c.milestones.map((m) => m.claimed)).toEqual([true, true, false, false, false]);
  expect((await wgz(page)).resources).toEqual({ food: before.food, bones: before.bones + 150 });
  await page.screenshot({ path: `${SHOTS}/codex-claimed.png` });

  // 回主頁紅點消失；重新整理後還是領過的
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  await page.waitForFunction(() => window.__WGZ__?.lobby?.codexReady === 0);
  await page.reload();
  await waitScene(page, 'LobbyScene');
  await openCodex(page);
  c = await codex(page);
  expect(c.claim.count).toBe(0);
  expect(c.milestones.filter((m) => m.claimed)).toHaveLength(2);
});

test('圖鑑：裝備頁列出全部裝備，點一下看說明與怎麼拿', async ({ page }) => {
  await openLobby(page, '?fast=1');
  // 給三種裝備：一般的兩種（其中一種升到 2 星）、爬塔飾品一種
  await patchSave(page, {
    gear: { 'tw-20': 1, 'ex-tieya': 2 },
    gearStars: { 'ex-tieya': 2 },
  });
  await openCodex(page);
  let c = await codex(page);
  await tap(page, c.tabs.gear);
  await page.waitForFunction(() => window.__WGZ__?.codex?.faction === 'gear');
  c = await codex(page);
  expect(c.total).toBe(66);
  expect(c.cells).toHaveLength(66);
  expect(c.owned).toBe(c.cells.filter((x) => x.owned).length);
  expect(c.cells.find((x) => x.id === 'tw-20')!.owned).toBe(true);
  expect(c.cells.find((x) => x.id === 'ex-tieya')!.owned).toBe(true);
  expect(c.cells[0].rarity).toBe('SSR');
  expect(c.cells[65].rarity).toBe('N');
  expect(c.milestones).toHaveLength(5);
  expect(c.milestones[4].target).toBe(66);
  for (const cell of c.cells) {
    expect(cell.x + cell.width).toBeLessThanOrEqual(W);
    expect(cell.y + cell.height).toBeLessThanOrEqual(H);
    expect(cell.width).toBeGreaterThanOrEqual(44);
    expect(cell.height).toBeGreaterThanOrEqual(44);
  }
  // 四顆分頁都點得到
  for (const t of Object.values(c.tabs)) {
    expect(t.width).toBeGreaterThanOrEqual(44);
    expect(t.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: `${SHOTS}/codex-gear.png` });

  // 有的：看得到幾件、幾星
  await tap(
    page,
    c.cells.find((x) => x.id === 'ex-tieya')!,
  );
  await page.waitForFunction(() => window.__WGZ__?.codex?.gearInfo === 'ex-tieya');
  await page.screenshot({ path: `${SHOTS}/codex-gear-info.png` });
  await tap(page, (await codex(page)).gearInfoClose!);
  await page.waitForFunction(() => window.__WGZ__?.codex?.gearInfo === null);

  // 還沒有的：一樣看得到說明與怎麼拿，點旁邊收起來
  const missing = c.cells.find((x) => !x.owned)!;
  await tap(page, missing);
  await page.waitForFunction((id) => window.__WGZ__?.codex?.gearInfo === id, missing.id);
  await page.screenshot({ path: `${SHOTS}/codex-gear-missing.png` });
  await tap(page, { x: 2, y: H - 6, width: 4, height: 4 });
  await page.waitForFunction(() => window.__WGZ__?.codex?.gearInfo === null);
});

test('圖鑑：背景頁看得到全部背景，點有的直接換主頁背景，收集三張領獎勵', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await openCodex(page);
  let c = await codex(page);
  await tap(page, c.tabs.background);
  await page.waitForFunction(() => window.__WGZ__?.codex?.faction === 'background');
  c = await codex(page);
  // 新遊戲只有一開始那一張
  expect(c).toMatchObject({ owned: 1, total: 12, background: 'slope' });
  expect(c.cells).toHaveLength(12);
  expect(c.cells.filter((x) => x.owned).map((x) => x.id)).toEqual(['slope']);
  expect(c.cells.find((x) => x.current)!.id).toBe('slope');
  expect(c.milestones.map((m) => m.target)).toEqual([3, 6, 9, 12]);
  await page.screenshot({ path: `${SHOTS}/codex-background-new.png` });
  // 點還沒有的：換不了
  await tap(
    page,
    c.cells.find((x) => x.id === 'snow')!,
  );
  await page.waitForTimeout(200);
  expect((await codex(page)).background).toBe('slope');
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');

  // 打倒前兩章頭目：三張，主頁「圖鑑」亮紅點
  await patchSave(page, { cleared: ['luoyepo-5', 'zhulindu-5'] });
  await page.waitForFunction(() => window.__WGZ__?.lobby?.codexReady === 1);
  await openCodex(page);
  // 自己的陣營沒獎勵、背景頁有：一進來就開背景頁
  await page.waitForFunction(() => window.__WGZ__?.codex?.faction === 'background');
  c = await codex(page);
  expect(c).toMatchObject({ owned: 3, total: 12 });
  expect(c.claim.count).toBe(1);
  expect(c.tabs.background.count).toBe(1);
  await page.screenshot({ path: `${SHOTS}/codex-background.png` });

  const before = (await wgz(page)).resources!;
  await tap(page, c.claim);
  await page.waitForFunction(() => window.__WGZ__?.codex?.claim.count === 0);
  expect((await wgz(page)).resources).toEqual({ food: before.food, bones: before.bones + 50 });

  // 點「雪嶺夜色」：主頁背景直接換過去
  await tap(
    page,
    c.cells.find((x) => x.id === 'snow')!,
  );
  await page.waitForFunction(() => window.__WGZ__?.codex?.background === 'snow');
  c = await codex(page);
  expect(c.cells.find((x) => x.current)!.id).toBe('snow');
  await page.screenshot({ path: `${SHOTS}/codex-background-picked.png` });
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  expect((await wgz(page)).lobby!.background).toBe('snow');
  await page.waitForFunction(() => window.__WGZ__?.lobby?.codexReady === 0);
});
