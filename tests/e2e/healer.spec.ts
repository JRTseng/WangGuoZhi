import { expect, test, type Page } from '@playwright/test';
import { battleFromMap, openLobby, tap, waitScene, wgz } from './helpers';

const CLOSE = { x: 0, y: 380, width: 844, height: 6 };
const ALL = ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'];
const GIFT = 'nuantong';

/** 戰鬥畫面按略過，等結算出現 */
async function skipToResult(page: Page) {
  await waitScene(page, 'BattleScene');
  await tap(page, (await wgz(page)).battle!.skipButton);
  await page.waitForFunction(() => !!window.__WGZ__?.result);
  return (await wgz(page)).result!;
}

/** 關掉結算；有劇情就略過，再從主頁回地圖 */
async function closeResult(page: Page, story: boolean) {
  await tap(page, CLOSE);
  if (story) {
    await waitScene(page, 'StoryScene');
    await tap(page, (await wgz(page)).story!.skip!);
    await waitScene(page, 'LobbyScene');
    await tap(page, (await wgz(page)).lobby!.buttons.expedition);
  }
  await waitScene(page, 'CampaignScene');
}

test('打贏第 1 章 Boss 送補血狗，之後可以帶牠出征', async ({ page }) => {
  test.setTimeout(120_000);
  // &battle=slow：戰鬥放慢，來得及按略過
  // &seed=7：固定種子。T023 起勝負是真的打出來的，這個種子五隻新手狗可以一路打贏到 Boss
  await openLobby(page, '?fast=1&battle=slow&seed=7');
  await tap(page, (await wgz(page)).lobby!.buttons.expedition);

  // 前 4 關：五隻全上，一路打過去（體力 100 剛好打 5 場）
  for (let i = 0; i < 4; i++) {
    await battleFromMap(page, i, ALL);
    const r = await skipToResult(page);
    expect(r.win, `第 ${i + 1} 關`).toBe(true);
    expect(r.newDogId).toBeUndefined();
    await closeResult(page, i === 0);
  }

  // 還沒通關：選狗畫面沒有補血狗
  await battleFromMap(page, 4, ALL);
  const r = await skipToResult(page);
  expect(r.win).toBe(true);
  expect(r.newDogId).toBe(GIFT);
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/healer-reward.png' });
  await closeResult(page, true);

  // 再進第 1 關選隊伍：補血狗在名單裡，定位篩選「補血」只有牠
  await tap(page, (await wgz(page)).map!.nodes[0]);
  await page.waitForFunction(() => !!window.__WGZ__?.map?.stagePanel);
  await tap(page, (await wgz(page)).map!.stagePanel!.go);
  await waitScene(page, 'ExpeditionScene');
  expect((await wgz(page)).expeditionPanel!.teamCards.map((c) => c.id)).toContain(GIFT);
  const chip = (await wgz(page)).picker!.roleChips.find((c) => c.key === '補血')!;
  await tap(page, chip);
  let e = (await wgz(page)).expeditionPanel!;
  expect(e.teamCards.map((c) => c.id)).toEqual([GIFT]);
  if (!e.teamCards[0].selected) await tap(page, e.teamCards[0]);
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/healer-pick.png' });

  // 體力用完了：補一次體力再帶牠開戰
  e = (await wgz(page)).expeditionPanel!;
  expect(e.teamCards[0].selected).toBe(true);
  expect(e.buyButton).toMatchObject({ kind: 'stamina' });
  await tap(page, e.buyButton!);
  await page.waitForFunction(() => !!window.__WGZ__?.shop);
  await tap(page, (await wgz(page)).shop!.ok);
  await page.waitForFunction(() => (window.__WGZ__?.stamina?.value ?? 0) >= 20);
  await tap(page, (await wgz(page)).shop!.cancel);
  await page.waitForFunction(() => !window.__WGZ__?.shop);
  await tap(page, (await wgz(page)).expeditionPanel!.confirmButton!);
  await waitScene(page, 'BattleScene');
  const b = (await wgz(page)).battle!;
  expect(b.team.map((u) => u.id)).toContain(GIFT);
  expect(b.heals).toBe(0);
  await tap(page, b.skipButton);
  await page.waitForFunction(() => window.__WGZ__?.battle?.phase === 'result');
  // 再打贏不會重複送
  expect((await wgz(page)).result!.newDogId).toBeUndefined();
});
