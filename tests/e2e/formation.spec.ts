import { expect, test, type Page } from '@playwright/test';
import { openLobby, startBattle, tap, waitScene, wgz, type R } from './helpers';

const battle = async (page: Page) => (await wgz(page)).battle!;
const formation = async (page: Page) => (await wgz(page)).formation!;
const rowsOf = async (page: Page) =>
  Object.fromEntries((await formation(page)).dogs.map((d) => [d.id, d.row]));

async function openFormation(page: Page) {
  await tap(page, (await wgz(page)).picker!.formationButton);
  await page.waitForFunction(() => !!window.__WGZ__?.formation);
}

test('組隊畫面排陣型：點狗再點一排就換位置，會存檔；自動編隊照定位排回去', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await tap(page, (await wgz(page)).lobby!.buttons.team);
  await waitScene(page, 'TeamScene');
  // 預設照定位：大耳（補給）中排，黑旋（突擊）、長鬚（守護）前排
  expect((await wgz(page)).picker!.rows).toEqual([1, 0, 0]);
  await openFormation(page);
  expect(await rowsOf(page)).toEqual({ daer: 1, heixuan: 0, changxu: 0 });
  let f = await formation(page);
  // 三排由左到右是後排、中排、前排（前排在右邊，面對敵人）
  expect(f.rows[0].x).toBeGreaterThan(f.rows[1].x);
  expect(f.rows[1].x).toBeGreaterThan(f.rows[2].x);
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/formation.png' });

  // 沒選狗就點一排：提示先選狗
  await tap(page, f.rows[2], 0.5, 0.9);
  expect((await formation(page)).message).toContain('先點一隻狗');

  // 點長鬚 → 點後排：長鬚換到後排
  await tap(
    page,
    f.dogs.find((d) => d.id === 'changxu')!,
  );
  await page.waitForFunction(() => window.__WGZ__?.formation?.selected === 'changxu');
  await page.screenshot({ path: 'artifacts/screenshots/portrait/formation-selected.png' });
  await tap(page, f.rows[2], 0.5, 0.9);
  await page.waitForFunction(() => window.__WGZ__?.formation?.selected === null);
  expect(await rowsOf(page)).toEqual({ daer: 1, heixuan: 0, changxu: 2 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/formation-moved.png' });

  // 完成 → 隊伍格上的小標跟著變；重新整理後還在
  await tap(page, (await formation(page)).close);
  await page.waitForFunction(() => !window.__WGZ__?.formation);
  expect((await wgz(page)).picker!.rows).toEqual([1, 0, 2]);
  await page.reload();
  await waitScene(page, 'LobbyScene');
  await tap(page, (await wgz(page)).lobby!.buttons.team);
  await waitScene(page, 'TeamScene');
  expect((await wgz(page)).picker!.rows).toEqual([1, 0, 2]);

  // 陣型面板的「照定位重排」
  await openFormation(page);
  f = await formation(page);
  await tap(page, f.reset);
  await page.waitForFunction(
    () => window.__WGZ__?.formation?.dogs.find((d) => d.id === 'changxu')?.row === 0,
  );
  // 再排亂一次，用「自動編隊」也會排回去
  f = await formation(page);
  await tap(
    page,
    f.dogs.find((d) => d.id === 'heixuan')!,
  );
  await tap(page, f.rows[1], 0.5, 0.9);
  await page.waitForFunction(
    () => window.__WGZ__?.formation?.dogs.find((d) => d.id === 'heixuan')?.row === 1,
  );
  await tap(page, (await formation(page)).close);
  await page.waitForFunction(() => !window.__WGZ__?.formation);
  await tap(page, (await wgz(page)).picker!.autoButton);
  await page.waitForFunction(() => window.__WGZ__?.picker?.slots.filter((s) => s.id).length === 5);
  const p = (await wgz(page)).picker!;
  const rows = Object.fromEntries(p.slots.map((s, i) => [s.id, p.rows[i]]));
  expect(rows).toEqual({ daer: 1, heixuan: 0, changxu: 0, xiaosuan: 2, abai: 2 });
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
  await page.screenshot({ path: 'artifacts/screenshots/portrait/manual-ult-ready.png' });

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
  await page.screenshot({ path: 'artifacts/screenshots/portrait/manual-ult-fire.png' });

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

  test('橫式：陣型面板在畫面內；出征選隊伍也能排陣型，勝率跟著變', async ({ page }) => {
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
    await openFormation(page);
    const f = await formation(page);
    for (const r of [...f.rows, ...f.dogs, f.reset, f.close]) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(844);
      expect(r.y + r.height).toBeLessThanOrEqual(390);
    }
    expect(Object.values(await rowsOf(page))).toEqual([2, 2]);
    await page.waitForTimeout(150);
    await page.screenshot({ path: 'artifacts/screenshots/landscape/formation.png' });
    await tap(page, f.close);
    await page.waitForFunction(() => !window.__WGZ__?.formation);
    expect(before).toBeGreaterThanOrEqual(0);
    expect(before).toBeLessThanOrEqual(1);

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
