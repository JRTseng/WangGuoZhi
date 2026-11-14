import { expect, test, type Page } from '@playwright/test';
import { battleFromMap, openLobby, tap, waitScene, wgz } from './helpers';

const CLOSE = { x: 0, y: 380, width: 844, height: 6 };
const STARTERS = ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'];
/** T024 的四隻新 SSR，加一隻新的 N 守護 */
const SQUAD = ['shidun', 'liuxing', 'songling', 'fuqiu', 'haiyan'];

/** 把存檔改成「已經抽到這幾隻」，重開遊戲 */
async function reloadWith(page: Page, patch: Record<string, unknown>) {
  await page.addInitScript((extra) => {
    if (sessionStorage.getItem('wgz-test-newdogs')) return;
    const raw = localStorage.getItem('wgz-save');
    if (!raw) return;
    sessionStorage.setItem('wgz-test-newdogs', '1');
    const file = JSON.parse(raw);
    Object.assign(file.state, extra);
    localStorage.setItem('wgz-save', JSON.stringify(file));
  }, patch);
  await page.reload();
  await waitScene(page, 'LobbyScene');
}

test('T024 新狗：六種定位各 5 隻，新 SSR 可以編隊、出征、放大絕招', async ({ page }) => {
  // &battle=slow：戰鬥放慢，來得及截圖與按略過；&seed=3：固定同一場戰鬥
  await openLobby(page, '?fast=1&battle=slow&seed=3');
  await tap(page, (await wgz(page)).lobby!.buttons.team);
  await waitScene(page, 'TeamScene');
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  await reloadWith(page, { owned: [...STARTERS, ...SQUAD], team: SQUAD, formation: {} });

  // 組隊：每種定位篩出來都是 5 隻
  await tap(page, (await wgz(page)).lobby!.buttons.team);
  await waitScene(page, 'TeamScene');
  const ids = async () => (await wgz(page)).picker!.cells.map((c) => c.id);
  const chip = async (key: string) =>
    (await wgz(page)).picker!.roleChips.find((c) => c.key === key)!;
  expect(await ids()).toHaveLength(30);
  for (const role of ['補給', '突擊', '守護', '謀略', '幸運', '補血']) {
    await tap(page, await chip(role));
    expect(await ids(), role).toHaveLength(5);
  }
  expect((await ids()).slice(0, 2)).toEqual(['haiyan', 'nuantong']);
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/newdogs-healers.png' });

  // 海晏的資料：技能說明寫的是護盾與救援
  const cell = (await wgz(page)).team!.dogs.find((d) => d.id === 'haiyan')!;
  await tap(page, cell);
  await page.waitForFunction(() => window.__WGZ__?.team?.panel === 'haiyan');
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/newdogs-haiyan.png' });
  await tap(page, CLOSE);
  await page.waitForFunction(() => window.__WGZ__?.team?.panel === null);
  await tap(page, await chip('all'));
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/newdogs-team.png' });
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');

  // 出征第 1 關：五隻都上場，SSR 第二次出手就放大絕招
  await tap(page, (await wgz(page)).lobby!.buttons.expedition);
  await battleFromMap(page, 0, SQUAD);
  await waitScene(page, 'BattleScene');
  const b = (await wgz(page)).battle!;
  expect(b.team.map((u) => u.id).sort()).toEqual([...SQUAD].sort());
  await page.waitForFunction(() => !!window.__WGZ__?.battle?.ult, undefined, { timeout: 60_000 });
  expect(SQUAD).toContain((await wgz(page)).battle!.ult!.id);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/newdogs-ultimate.png' });
  if ((await wgz(page)).battle!.phase === 'playing') {
    await tap(page, (await wgz(page)).battle!.skipButton);
  }
  await page.waitForFunction(() => !!window.__WGZ__?.result);
  expect((await wgz(page)).result!.win).toBe(true);
});
