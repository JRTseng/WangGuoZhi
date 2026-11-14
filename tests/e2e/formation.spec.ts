import { expect, test, type Page } from '@playwright/test';
import { drag, openLobby, startBattle, tap, waitScene, wgz, type R } from './helpers';

const battle = async (page: Page) => (await wgz(page)).battle!;
/** 陣型九宮格的某一格（row 0 前、1 中、2 後；lane 0 上、1 中、2 下） */
const cellAt = async (page: Page, row: number, lane: number) =>
  (await wgz(page)).picker!.board.find((c) => c.row === row && c.lane === lane)!;
const boardIds = async (page: Page) =>
  (await wgz(page)).picker!.board.filter((c) => c.id).map((c) => [c.id, c.row, c.lane]);
const card = async (page: Page, id: string) =>
  (await wgz(page)).picker!.cells.find((c) => c.id === id)!;
const teamIds = async (page: Page) =>
  (await wgz(page)).picker!.slots.map((s) => s.id).filter(Boolean);
/** 卡片格直式會上下捲動，要長按才拿得起來 */
const HOLD = 400;

test('組隊畫面：3×3 九宮格，拖曳換位置、對調、從清單拖上去上陣，會存檔；自動編隊照定位排回去', async ({
  page,
}) => {
  // 流程長（拖曳、重新整理），CI 上超過預設的 60 秒
  test.setTimeout(180_000);
  await openLobby(page, '?fast=1');
  await tap(page, (await wgz(page)).lobby!.buttons.team);
  await waitScene(page, 'TeamScene');
  // 預設照定位：大耳（補給）中排，黑旋（突擊）、長鬚（守護）前排
  let p = (await wgz(page)).picker!;
  expect(p.rows).toEqual([1, 0, 0]);
  // 九宮格：九格都畫出來（含空格），大小一樣，橫的直的都對齊；前排在右邊（面對敵人）
  expect(p.board).toHaveLength(9);
  for (const c of p.board) {
    expect(c.width).toBe(p.board[0].width);
    expect(c.height).toBe(p.board[0].height);
    expect(c.x).toBe(p.board.find((o) => o.row === c.row && o.lane === 0)!.x);
    expect(c.y).toBe(p.board.find((o) => o.row === 0 && o.lane === c.lane)!.y);
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.x + c.width).toBeLessThanOrEqual(844);
  }
  expect(p.boardRows[0].x).toBeGreaterThan(p.boardRows[1].x);
  expect(p.boardRows[1].x).toBeGreaterThan(p.boardRows[2].x);
  // 一排一隻站中間，兩隻站上下
  expect(await boardIds(page)).toEqual([
    ['heixuan', 0, 0],
    ['changxu', 0, 2],
    ['daer', 1, 1],
  ]);
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/formation.png' });

  // 按住長鬚拖到後排上面那一格：換過去
  await drag(page, await cellAt(page, 0, 2), await cellAt(page, 2, 0));
  await page.waitForFunction(
    () => window.__WGZ__?.picker?.board.find((c) => c.id === 'changxu')?.row === 2,
  );
  expect((await cellAt(page, 2, 0)).id).toBe('changxu');
  expect((await cellAt(page, 0, 2)).id).toBeNull();
  expect((await wgz(page)).picker!.rows).toEqual([1, 0, 2]);
  // 大耳拖到黑旋那一格：兩隻對調
  await drag(page, await cellAt(page, 1, 1), await cellAt(page, 0, 0));
  await page.waitForFunction(
    () => window.__WGZ__?.picker?.board.find((c) => c.id === 'daer')?.row === 0,
  );
  expect((await cellAt(page, 0, 0)).id).toBe('daer');
  expect((await cellAt(page, 1, 1)).id).toBe('heixuan');
  expect((await wgz(page)).picker!.lifting).toBeNull();
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/formation-moved.png' });

  // 重新整理後站位還在（有存檔）
  await page.reload();
  await waitScene(page, 'LobbyScene');
  await tap(page, (await wgz(page)).lobby!.buttons.team);
  await waitScene(page, 'TeamScene');
  expect(await boardIds(page)).toEqual([
    ['daer', 0, 0],
    ['heixuan', 1, 1],
    ['changxu', 2, 0],
  ]);

  // 從下面的清單長按小算，拖到後排下面那一格：上陣並站那一格
  await drag(page, await card(page, 'xiaosuan'), await cellAt(page, 2, 2), HOLD);
  await page.waitForFunction(
    () => window.__WGZ__?.picker?.board.find((c) => c.id === 'xiaosuan')?.lane === 2,
  );
  expect(await teamIds(page)).toEqual(['daer', 'heixuan', 'changxu', 'xiaosuan']);
  expect((await card(page, 'xiaosuan')).selected).toBe(true);
  // 阿白拖到大耳身上：換大耳下來
  await drag(page, await card(page, 'abai'), await cellAt(page, 0, 0), HOLD);
  await page.waitForFunction(() => window.__WGZ__?.picker?.board.some((c) => c.id === 'abai'));
  expect(await teamIds(page)).toEqual(['abai', 'heixuan', 'changxu', 'xiaosuan']);
  expect((await cellAt(page, 0, 0)).id).toBe('abai');
  // 沒擁有的狗拿不起來
  await drag(page, await card(page, 'tieya'), await cellAt(page, 1, 0), HOLD);
  await page.waitForTimeout(150);
  expect((await cellAt(page, 1, 0)).id).toBeNull();
  // （沒拿起來的話直著滑就是捲動清單，捲回最上面）
  const g = (await wgz(page)).picker!.grid;
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.wheel(0, -2000);
  await page.waitForFunction(() => window.__WGZ__?.picker?.scrollY === 0);
  // 長按一下沒拖走：不算點擊，不會跳出資訊面板
  const c0 = await card(page, 'daer');
  await drag(page, c0, c0, HOLD);
  await page.waitForTimeout(150);
  expect((await wgz(page)).team!.panel).toBeNull();

  // 點一下九宮格上的狗：移出隊伍；把狗從九宮格拖回清單也是移出
  await tap(page, await cellAt(page, 2, 2));
  await page.waitForFunction(() => !window.__WGZ__?.picker?.board.some((c) => c.id === 'xiaosuan'));
  await drag(page, await cellAt(page, 0, 0), (await wgz(page)).picker!.grid);
  await page.waitForFunction(() => !window.__WGZ__?.picker?.board.some((c) => c.id === 'abai'));
  expect(await teamIds(page)).toEqual(['heixuan', 'changxu']);
  // 拖到格子外又不是清單（例如標題列）：彈回去，不變
  await drag(page, await cellAt(page, 1, 1), { x: 150, y: 10, width: 20, height: 20 });
  await page.waitForTimeout(150);
  expect((await cellAt(page, 1, 1)).id).toBe('heixuan');

  // 「自動編隊」：五隻照定位排回去；滿了再拖到空格會提示，拖到隊友身上才能換
  await tap(page, (await wgz(page)).picker!.autoButton);
  await page.waitForFunction(() => window.__WGZ__?.picker?.slots.filter((s) => s.id).length === 5);
  p = (await wgz(page)).picker!;
  const rows = Object.fromEntries(p.slots.map((s, i) => [s.id, p.rows[i]]));
  expect(rows).toEqual({ daer: 1, heixuan: 0, changxu: 0, xiaosuan: 2, abai: 2 });
  await drag(page, await cellAt(page, 2, 0), await cellAt(page, 2, 1));
  await page.waitForFunction(
    () => window.__WGZ__?.picker?.board.find((c) => c.row === 2 && c.lane === 1)?.id,
  );
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/formation-full.png' });
});

test('戰鬥照陣型站位；關掉自動放招後，點 EN 滿的狗才會放大絕招', async ({ page }) => {
  test.setTimeout(150_000);
  await openLobby(page, '?fast=1&battle=slow&seed=5');
  await startBattle(page, 0, ['daer', 'xiaosuan']);
  await waitScene(page, 'BattleScene');
  let b = await battle(page);
  // 大耳中排、小算後排；野犬兩隻前排、一隻中排。前排最靠近中線
  expect(b.team.map((u) => u.row)).toEqual([1, 2]);
  expect(b.enemies.map((u) => u.row)).toEqual([0, 0, 1]);
  expect(b.team[0].x).toBeGreaterThan(b.team[1].x);
  expect(b.enemies[2].x).toBeGreaterThan(b.enemies[0].x);
  expect(b.autoUlt).toBe(true);

  // 關掉自動放招，切到 ×2
  await tap(page, b.autoButton);
  await page.waitForFunction(() => window.__WGZ__?.battle?.autoUlt === false);
  await tap(page, b.speedButton);
  await page.waitForFunction(() => window.__WGZ__?.battle?.speed === 2);

  // 大耳 EN 滿了：不點牠就不放，照常一般攻擊，EN 留著
  await page.waitForFunction(() => window.__WGZ__?.battle?.team[0].en === 100, null, {
    timeout: 60_000,
  });
  const full = (await battle(page)).index;
  await page.waitForFunction((i) => (window.__WGZ__?.battle?.index ?? 0) >= i + 5, full, {
    timeout: 30_000,
  });
  b = await battle(page);
  expect(b.ults).toBe(0);
  expect(b.team[0]).toMatchObject({ en: 100, armed: false });
  expect(b.phase).toBe('playing');
  await page.screenshot({ path: 'artifacts/screenshots/landscape/manual-ult-ready.png' });

  // 點大耳：輪到牠就放大絕招
  const u = b.team[0];
  const head: R = { x: u.x - u.r, y: u.y - u.r, width: u.r * 2, height: u.r * 2 };
  await tap(page, head);
  await page.waitForFunction(
    () => window.__WGZ__?.battle?.team[0].armed === true || !!window.__WGZ__?.battle?.ult,
  );
  await page.waitForFunction(() => window.__WGZ__?.battle?.ult?.id === 'daer', null, {
    timeout: 30_000,
  });
  b = await battle(page);
  expect(b.ults).toBe(1);
  expect(b.ult).toMatchObject({ id: 'daer', kind: 'buff' });
  await page.waitForTimeout(450);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/manual-ult-fire.png' });

  // 略過：剩下的自動算完；結算和畫面上的勝負一致，選擇（不自動放招）有存檔
  await tap(page, b.skipButton);
  await page.waitForFunction(() => window.__WGZ__?.battle?.phase === 'result');
  b = await battle(page);
  const result = (await wgz(page)).result!;
  expect(result.win).toBe(b.win);
  expect(b.enemies.every((e) => e.hp === 0)).toBe(b.win);
  expect(b.autoUlt).toBe(false);
  await page.reload();
  await waitScene(page, 'LobbyScene');
  expect((await wgz(page)).resources!.food).toBe(1200 + result.food);
  await startBattle(page, 0, ['daer', 'xiaosuan']);
  await waitScene(page, 'BattleScene');
  expect((await battle(page)).autoUlt).toBe(false);
});

test('開戰到一半關掉遊戲：下次開啟時用自動放招算完，體力不會白花', async ({ page }) => {
  await openLobby(page, '?fast=1&battle=slow&seed=5');
  await startBattle(page);
  await waitScene(page, 'BattleScene');
  expect((await battle(page)).phase).toBe('playing');
  await page.reload();
  await waitScene(page, 'LobbyScene');
  const s = await wgz(page);
  // 第 1 關的獎勵 120／5 已經入帳，體力扣了 20
  expect(s.resources).toEqual({ food: 1320, bones: 55 });
  expect(s.stamina!.value).toBe(80);
});

test.describe('手機橫放', () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test('橫式：左邊九宮格、右邊清單；出征選隊伍也能拖曳上陣與換位置', async ({ page }) => {
    await openLobby(page, '?fast=1&battle=slow&seed=7');
    await tap(page, (await wgz(page)).lobby!.buttons.expedition);
    await waitScene(page, 'CampaignScene');
    await tap(page, (await wgz(page)).map!.nodes[0]);
    await page.waitForFunction(() => !!window.__WGZ__?.map?.stagePanel);
    await tap(page, (await wgz(page)).map!.stagePanel!.go);
    await waitScene(page, 'ExpeditionScene');
    // 只留阿白與小算兩隻後衛：照定位都在後排
    for (const card of (await wgz(page)).expeditionPanel!.teamCards) {
      if (card.selected !== ['xiaosuan', 'abai'].includes(card.id)) await tap(page, card);
    }
    const before = (await wgz(page)).expeditionPanel!.winChance!;
    expect(before).toBeGreaterThanOrEqual(0);
    expect(before).toBeLessThanOrEqual(1);
    let p = (await wgz(page)).picker!;
    expect(p.board).toHaveLength(9);
    for (const r of [...p.boardRows, ...p.board]) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(56);
      expect(r.x + r.width).toBeLessThanOrEqual(844);
      expect(r.y + r.height).toBeLessThanOrEqual(390);
    }
    // 九宮格在左邊、清單在右邊，不重疊；也不會蓋到開戰按鈕
    const confirm = (await wgz(page)).expeditionPanel!.confirmButton!;
    for (const r of p.boardRows) {
      expect(r.x + r.width).toBeLessThanOrEqual(p.grid.x);
      expect(r.y + r.height).toBeLessThanOrEqual(confirm.y);
    }
    expect(p.rows).toEqual([2, 2]);
    await page.waitForTimeout(150);
    await page.screenshot({ path: 'artifacts/screenshots/landscape/formation.png' });

    // 橫式清單在右邊：把大耳往左拖到前排中間那一格就上陣（不用長按）
    await drag(page, await card(page, 'daer'), await cellAt(page, 0, 1));
    await page.waitForFunction(() => window.__WGZ__?.picker?.board.some((c) => c.id === 'daer'));
    expect((await cellAt(page, 0, 1)).id).toBe('daer');
    expect((await card(page, 'daer')).selected).toBe(true);
    // 小算從後排拖到中排：勝率重新算過
    const from = (await wgz(page)).picker!.board.find((c) => c.id === 'xiaosuan')!;
    await drag(page, from, await cellAt(page, 1, 0));
    await page.waitForFunction(
      () => window.__WGZ__?.picker?.board.find((c) => c.id === 'xiaosuan')?.row === 1,
    );
    p = (await wgz(page)).picker!;
    expect(p.slots.filter((s) => s.id)).toHaveLength(3);
    const after = (await wgz(page)).expeditionPanel!.winChance!;
    expect(after).toBeGreaterThanOrEqual(0);
    expect(after).toBeLessThanOrEqual(1);
    await page.screenshot({ path: 'artifacts/screenshots/landscape/formation-dragged.png' });

    // 五隻全上開戰：橫式三排各站一直行
    for (const card of (await wgz(page)).expeditionPanel!.teamCards) {
      if (!card.selected) await tap(page, card);
    }
    await tap(page, (await wgz(page)).expeditionPanel!.confirmButton!);
    await waitScene(page, 'BattleScene');
    const b = await battle(page);
    expect(b.team).toHaveLength(5);
    const xs = (row: number) => [...new Set(b.team.filter((u) => u.row === row).map((u) => u.x))];
    expect(xs(0)).toHaveLength(1);
    expect(xs(1)).toHaveLength(1);
    expect(xs(2)).toHaveLength(1);
    expect(xs(0)[0]).toBeGreaterThan(xs(1)[0]);
    expect(xs(1)[0]).toBeGreaterThan(xs(2)[0]);
    await page.waitForFunction(() => (window.__WGZ__?.battle?.index ?? 0) >= 3);
    await page.screenshot({ path: 'artifacts/screenshots/landscape/formation-battle.png' });
  });
});
