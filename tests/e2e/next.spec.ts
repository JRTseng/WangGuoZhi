import { expect, test, type Page } from '@playwright/test';
import { battleFromMap, enableSkipBattle, openLobby, tap, waitScene, wgz } from './helpers';

const SHOTS = 'artifacts/screenshots/landscape';
const CLOSE = { x: 0, y: 380, width: 844, height: 6 };
const ALL = ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'];

/** 戰鬥畫面按略過，等結算出現 */
async function skipToResult(page: Page, stageId: string) {
  await page.waitForFunction(
    (id) => window.__WGZ__?.scene === 'BattleScene' && window.__WGZ__?.battle?.stageId === id,
    stageId,
  );
  await tap(page, (await wgz(page)).battle!.skipButton);
  await page.waitForFunction(() => !!window.__WGZ__?.result);
  return wgz(page);
}

test('打贏後按「下一關」用同一隊直接挑戰下一關；體力與次數先不限', async ({ page }) => {
  test.setTimeout(120_000);
  // limits=0：照現在的預設（不限體力與次數）跑；&battle=slow：來得及按略過；&seed=7：固定種子
  await openLobby(page, '?fast=1&battle=slow&seed=7&limits=0');
  expect((await wgz(page)).status!.label).toBe('體力 無限');
  await tap(page, (await wgz(page)).lobby!.buttons.expedition);

  // 第 1 關五隻全上，打贏：結算多一顆「下一關」
  await battleFromMap(page, 0, ALL);
  let s = await skipToResult(page, 'luoyepo-1');
  expect(s.result!.win).toBe(true);
  expect(s.nextButton).toMatchObject({ stageId: 'luoyepo-2' });
  await page.screenshot({ path: `${SHOTS}/next-button.png` });

  // 按下一關：第一次過關先看劇情，看完直接開打第 2 關（只能上 3 隻，留戰力最高的 3 隻）
  await tap(page, s.nextButton!);
  await waitScene(page, 'StoryScene');
  await tap(page, (await wgz(page)).story!.skip!);
  s = await skipToResult(page, 'luoyepo-2');
  expect(s.battle!.team).toHaveLength(3);
  expect(s.result!.win).toBe(true);
  expect(s.nextButton).toMatchObject({ stageId: 'luoyepo-3' });
  await page.screenshot({ path: `${SHOTS}/next-button-trimmed.png` });

  // 再按一次：沒有劇情，直接進第 3 關；隊伍還是剛剛那 3 隻
  const team = s.battle!.team.map((u) => u.id);
  await tap(page, s.nextButton!);
  s = await skipToResult(page, 'luoyepo-3');
  expect(s.battle!.team.map((u) => u.id)).toEqual(team);

  // 點其他地方照舊回地圖；打了三場體力沒有少
  await tap(page, CLOSE);
  await waitScene(page, 'CampaignScene');
  await tap(page, (await wgz(page)).map!.nodes[0]);
  await page.waitForFunction(() => !!window.__WGZ__?.map?.stagePanel);
  await page.screenshot({ path: `${SHOTS}/unlimited-stage-panel.png` });
  await tap(page, (await wgz(page)).map!.stagePanel!.go);
  await waitScene(page, 'ExpeditionScene');
  const e = (await wgz(page)).expeditionPanel!;
  expect(e.confirmButton).toMatchObject({ enabled: true });
  expect(e.buyButton).toBeNull();
  expect((await wgz(page)).stamina!.value).toBe(100);
  await page.screenshot({ path: `${SHOTS}/unlimited-team.png` });
});

test('打輸、或開了「略過戰鬥畫面」：下一關按鈕照規則出現', async ({ page }) => {
  test.setTimeout(120_000);
  await openLobby(page, '?fast=1&seed=7&limits=0');
  await enableSkipBattle(page);
  await tap(page, (await wgz(page)).lobby!.buttons.expedition);

  // 略過戰鬥畫面：結算一樣有「下一關」，按了直接看到下一關的結算
  await battleFromMap(page, 0, ALL);
  await page.waitForFunction(() => !!window.__WGZ__?.result);
  let s = await wgz(page);
  expect(s.result!.win).toBe(true);
  expect(s.nextButton).toMatchObject({ stageId: 'luoyepo-2' });
  await tap(page, s.nextButton!);
  await waitScene(page, 'StoryScene');
  await tap(page, (await wgz(page)).story!.skip!);
  await page.waitForFunction(
    () => window.__WGZ__?.battle?.stageId === 'luoyepo-2' && !!window.__WGZ__?.result,
  );
  s = await wgz(page);
  expect(s.battle!.skipped).toBe(true);
  expect(!!s.nextButton).toBe(s.result!.win);
  await tap(page, CLOSE);
  await waitScene(page, 'CampaignScene');

  // 只帶一隻去打第 2 關一定輸：沒有「下一關」
  await battleFromMap(page, 1, ['abai']);
  await page.waitForFunction(() => !!window.__WGZ__?.result);
  s = await wgz(page);
  expect(s.result!.win).toBe(false);
  expect(s.nextButton).toBeNull();
});
