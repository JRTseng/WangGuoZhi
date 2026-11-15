import { expect, test } from '@playwright/test';
import { hold, openLobby, patchSave, tap, waitScene, wgz } from './helpers';

const SHOTS = 'artifacts/screenshots/landscape';

test('成長技能：每 10 級學一個；組隊時長按狗狗圖示看素質與技能', async ({ page }) => {
  test.setTimeout(90_000);
  await openLobby(page, '?fast=1');
  // 大耳練到 25 級：學會 Lv.10、Lv.20 兩個
  const dogs = await page.evaluate(
    () => JSON.parse(window.localStorage.getItem('wgz-save') ?? '{"state":{"dogs":{}}}').state.dogs,
  );
  await patchSave(page, { dogs: { ...dogs, daer: { ...(dogs.daer ?? {}), level: 25, exp: 0 } } });
  await tap(page, (await wgz(page)).lobby!.buttons.team);
  await waitScene(page, 'TeamScene');

  // 卡片格：長按打開，手放開不會馬上關掉，也不會把狗拿起來
  const card = (await wgz(page)).team!.dogs.find((d) => d.id === 'daer')!;
  await hold(page, card, 900);
  await page.waitForFunction(() => window.__WGZ__?.team?.panel === 'daer');
  let t = (await wgz(page)).team!;
  expect(t.panelSkills).toEqual({ learned: 2, total: 10 });
  expect((await wgz(page)).picker!.lifting).toBeNull();
  await page.screenshot({ path: `${SHOTS}/dog-skills.png` });
  // 點旁邊關閉
  await page.mouse.click(8, 8);
  await page.waitForFunction(() => window.__WGZ__?.team?.panel === null);

  // 九宮格上的狗：長按也是看資料，不會被移出隊伍
  const before = (await wgz(page)).picker!.slots.map((s) => s.id);
  const slot = (await wgz(page)).picker!.board.find((b) => b.id === 'daer')!;
  await hold(page, slot, 900);
  await page.waitForFunction(() => window.__WGZ__?.team?.panel === 'daer');
  await page.mouse.click(8, 8);
  await page.waitForFunction(() => window.__WGZ__?.team?.panel === null);
  expect((await wgz(page)).picker!.slots.map((s) => s.id)).toEqual(before);

  // 短短按一下九宮格上的狗還是移出隊伍
  await tap(page, slot);
  await page.waitForFunction(() => !window.__WGZ__?.picker?.slots.some((s) => s.id === 'daer'));
  t = (await wgz(page)).team!;
  expect(t.panel).toBeNull();

  // 出征選隊伍：長按只看資料，不改選取
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  await tap(page, (await wgz(page)).lobby!.buttons.expedition);
  await waitScene(page, 'CampaignScene');
  await tap(page, (await wgz(page)).map!.nodes[0]);
  await page.waitForFunction(() => !!window.__WGZ__?.map?.stagePanel);
  await tap(page, (await wgz(page)).map!.stagePanel!.go);
  await waitScene(page, 'ExpeditionScene');
  const cards = (await wgz(page)).expeditionPanel!.teamCards;
  const picked = cards.filter((c) => c.selected).map((c) => c.id);
  await hold(
    page,
    cards.find((c) => c.id === 'daer')!,
    900,
  );
  await page.waitForFunction(() => window.__WGZ__?.expeditionPanel?.info?.dogId === 'daer');
  expect((await wgz(page)).expeditionPanel!.info).toMatchObject({ learned: 2, total: 10 });
  await page.screenshot({ path: `${SHOTS}/dog-skills-expedition.png` });
  await tap(page, (await wgz(page)).expeditionPanel!.info!.close!);
  await page.waitForFunction(() => !window.__WGZ__?.expeditionPanel?.info);
  expect(
    (await wgz(page)).expeditionPanel!.teamCards.filter((c) => c.selected).map((c) => c.id),
  ).toEqual(picked);
});
