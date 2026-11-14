import { expect, test, type Page } from '@playwright/test';
import { openLobby, patchSave, tap, waitScene, wgz } from './helpers';

const STARTERS = ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'];
const CHAPTERS = [
  'luoyepo',
  'zhulindu',
  'xuelingguan',
  'taohuagu',
  'huangshadao',
  'wuzhaoze',
  'chiyanling',
  'bihaiwan',
  'yundingzhan',
  'wangdu',
];
const ALL_STAGES = CHAPTERS.flatMap((c) => [1, 2, 3, 4, 5].map((n) => `${c}-${n}`));
const SHOTS = 'artifacts/screenshots/landscape';

/** 在地圖點某一關，等關卡面板出來 */
async function openStage(page: Page, node: number, stageId: string) {
  await tap(page, (await wgz(page)).map!.nodes[node]);
  await page.waitForFunction((id) => window.__WGZ__?.map?.stagePanel?.stageId === id, stageId);
  return (await wgz(page)).map!.stagePanel!;
}

test('T018 關卡敵人與上陣數量：十個章節，每關自己的敵人，上陣數量跟著敵人數', async ({ page }) => {
  await openLobby(page, '?fast=1&battle=slow&seed=3');
  // 全部關卡都打過（十章都開放），組隊編排帶滿五隻
  await patchSave(page, {
    cleared: ALL_STAGES,
    // 劇情也都看過，打完才不會跳去播劇情
    seenStories: [
      'prologue',
      'ch1-first',
      ...Array.from({ length: 10 }, (_, i) => `ch${i + 1}-boss`),
    ],
    team: STARTERS,
    formation: {},
  });

  await tap(page, (await wgz(page)).lobby!.buttons.expedition);
  await waitScene(page, 'CampaignScene');
  const map = (await wgz(page)).map!;
  expect(map.chapters).toHaveLength(10);
  expect(map.chapters.every((c) => c.unlocked)).toBe(true);
  // 分頁都在畫面裡、彼此不重疊
  map.chapters.forEach((c, i) => {
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.x + c.width).toBeLessThanOrEqual(844);
    if (i > 0)
      expect(c.x).toBeGreaterThanOrEqual(map.chapters[i - 1].x + map.chapters[i - 1].width);
  });
  // 全部打過時預設停在最後一章
  expect(map.chapter).toBe(9);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/stages-map-ch10.png` });

  // 第十章 Boss：頭目加四隻小兵，可以上五隻
  const boss = await openStage(page, 4, 'wangdu-5');
  expect(boss).toMatchObject({ teamMax: 5, enemies: 5 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/stages-boss-panel.png` });
  await tap(page, boss.go);
  await waitScene(page, 'ExpeditionScene');
  expect((await wgz(page)).expeditionPanel!.teamCards.filter((c) => c.selected)).toHaveLength(5);
  await tap(page, (await wgz(page)).expeditionPanel!.confirmButton!);
  await waitScene(page, 'BattleScene');
  const b = (await wgz(page)).battle!;
  expect(b.enemies).toHaveLength(5);
  expect(b.team).toHaveLength(5);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/stages-boss-battle.png` });
  await tap(page, b.skipButton);
  await page.waitForFunction(() => !!window.__WGZ__?.result);
  // 新手五隻打第十章 Boss 當然打不贏
  expect((await wgz(page)).result!.win).toBe(false);
  await page.waitForTimeout(200);
  await tap(page, { x: 0, y: 380, width: 844, height: 6 });
  await waitScene(page, 'CampaignScene');

  // 第三章第 3 關：兩隻精銳，只能上兩隻
  await tap(page, (await wgz(page)).map!.chapters[2]);
  await page.waitForFunction(() => window.__WGZ__?.map?.chapter === 2);
  await page.waitForTimeout(200);
  const elite = await openStage(page, 2, 'xuelingguan-3');
  expect(elite).toMatchObject({ teamMax: 2, enemies: 2 });
  await tap(page, elite.go);
  await waitScene(page, 'ExpeditionScene');
  let cards = (await wgz(page)).expeditionPanel!.teamCards;
  // 帶五隻進來，只留兩隻
  expect(cards.filter((c) => c.selected)).toHaveLength(2);
  // 滿了再點別隻也加不進去
  await tap(
    page,
    cards.find((c) => !c.selected)!,
  );
  cards = (await wgz(page)).expeditionPanel!.teamCards;
  expect(cards.filter((c) => c.selected)).toHaveLength(2);
  expect((await wgz(page)).expeditionPanel!.confirmButton!.enabled).toBe(true);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/stages-team-limit.png` });
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'CampaignScene');

  // 第一章：第 1 關五隻小卒可以上五隻，第 2 關三隻小卒只能上三隻
  await tap(page, (await wgz(page)).map!.chapters[0]);
  await page.waitForFunction(() => window.__WGZ__?.map?.chapter === 0);
  await page.waitForTimeout(200);
  const first = await openStage(page, 0, 'luoyepo-1');
  expect(first).toMatchObject({ teamMax: 5, enemies: 5 });
  await tap(page, { x: 4, y: 200, width: 4, height: 4 });
  await page.waitForFunction(() => window.__WGZ__?.map?.stagePanel === null);
  const second = await openStage(page, 1, 'luoyepo-2');
  expect(second).toMatchObject({ teamMax: 3, enemies: 3 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/stages-panel.png` });
});
