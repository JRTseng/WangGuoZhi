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
  const owned = [...starters, ...ids.filter((id) => !starters.includes(id)).slice(0, 15)];
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
