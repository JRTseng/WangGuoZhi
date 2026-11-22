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

  // 再按一次：沒有劇情，直接進第 3 關；第 3 關能上比較多，剛剛留下來的隊員自動補回來
  const team = s.battle!.team.map((u) => u.id);
  await tap(page, s.nextButton!);
  s = await skipToResult(page, 'luoyepo-3');
  const now = s.battle!.team.map((u) => u.id);
  expect(now.length).toBeGreaterThan(team.length);
  expect(now.slice(0, team.length)).toEqual(team);
  for (const id of now) expect(ALL).toContain(id);

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

test('勾「自動」：打贏後自己接著打下一關，取消勾選就停', async ({ page }) => {
  test.setTimeout(120_000);
  await openLobby(page, '?fast=1&seed=7&limits=0');
  await enableSkipBattle(page);
  await tap(page, (await wgz(page)).lobby!.buttons.expedition);
  await battleFromMap(page, 0, ALL);
  await page.waitForFunction(() => !!window.__WGZ__?.result);
  let s = await wgz(page);
  expect(s.result!.win).toBe(true);
  // 「自動」在「下一關」右邊、同一排，預設沒勾；沒勾就不會自己走
  expect(s.nextAuto).toMatchObject({ on: false });
  expect(s.nextAuto!.y).toBe(s.nextButton!.y);
  expect(s.nextAuto!.x).toBeGreaterThanOrEqual(s.nextButton!.x + s.nextButton!.width);
  expect(s.nextAuto!.height).toBeGreaterThanOrEqual(40);
  await page.waitForTimeout(3700);
  expect((await wgz(page)).scene).toBe('ExpeditionScene');

  // 勾起來：等一下自己按下一關（第一次過關先看劇情）
  await tap(page, s.nextAuto!);
  await page.waitForFunction(
    () => JSON.parse(window.localStorage.getItem('wgz-save')!).state.settings.autoNext === true,
  );
  // 畫面上有倒數：從 3 秒開始往下數
  await page.waitForFunction(() => window.__WGZ__?.nextAuto?.seconds === 3);
  await page.screenshot({ path: `${SHOTS}/next-auto.png` });
  // 截圖慢的時候倒數可能已經數完、換到下一個畫面（那時沒有倒數），所以沒有數字也算過
  await page.waitForFunction(() => (window.__WGZ__?.nextAuto?.seconds ?? 0) <= 2);
  await waitScene(page, 'StoryScene');
  await tap(page, (await wgz(page)).story!.skip!);
  await page.waitForFunction(
    () => window.__WGZ__?.battle?.stageId === 'luoyepo-2' && !!window.__WGZ__?.result,
  );
  s = await wgz(page);
  expect(s.result!.win).toBe(true);
  // 下一場的結算記得剛剛勾了，不用再按就進第 3 關
  expect(s.nextAuto).toMatchObject({ on: true });
  await page.waitForFunction(
    () => window.__WGZ__?.battle?.stageId === 'luoyepo-3' && !!window.__WGZ__?.result,
  );
  s = await wgz(page);
  // 第 2 關只能上 3 隻，第 3 關能上比較多：自動補滿，不會一直維持 3 隻
  expect(s.battle!.team.length).toBeGreaterThan(3);
  if (s.result!.win) {
    // 取消勾選：倒數停掉，停在這一關的結算，不再往下打。
    // 機器很慢時，上面那幾步還沒做完倒數就數完、已經自己打到下一關（2026-11-23 CI 因此停在第 4 關而失敗），
    // 所以點之前重新抓一次現在這場結算的勾選框，並以「取消當下是哪一關」為準，不寫死第 3 關
    await page.waitForFunction(() => !!window.__WGZ__?.result && window.__WGZ__?.nextAuto?.on);
    await tap(page, (await wgz(page)).nextAuto!);
    await page.waitForFunction(
      () => JSON.parse(window.localStorage.getItem('wgz-save')!).state.settings.autoNext === false,
    );
    s = await wgz(page);
    expect(s.nextAuto).toMatchObject({ on: false, seconds: null });
    const stoppedAt = s.battle!.stageId;
    await page.waitForTimeout(3700);
    s = await wgz(page);
    expect(s.battle!.stageId).toBe(stoppedAt);
    expect(s.scene).toBe('BattleScene');
  } else {
    // 打輸就沒有下一關，也沒有自動
    expect(s.nextButton).toBeNull();
    expect(s.nextAuto).toBeNull();
  }
});
