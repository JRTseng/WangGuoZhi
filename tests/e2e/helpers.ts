import type { Page } from '@playwright/test';

export interface R {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const wgz = (page: Page) => page.evaluate(() => window.__WGZ__!);

/** 點遊戲座標中某個矩形的中心（FIT 縮放後換算成頁面座標，直式、橫式都適用） */
export async function tap(page: Page, r: R, fx = 0.5, fy = 0.5) {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('找不到 canvas');
  const gw = await page.evaluate(() => window.__WGZ__?.size?.width ?? 390);
  const s = box.width / gw;
  await page.mouse.click(box.x + (r.x + r.width * fx) * s, box.y + (r.y + r.height * fy) * s);
}

/** 從一個矩形的中心按住（hold 毫秒，長按用），拖到另一個矩形的中心放開 */
export async function drag(page: Page, from: R, to: R, hold = 0) {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('找不到 canvas');
  const gw = await page.evaluate(() => window.__WGZ__?.size?.width ?? 390);
  const s = box.width / gw;
  const at = (r: R) => [box.x + (r.x + r.width / 2) * s, box.y + (r.y + r.height / 2) * s] as const;
  const [x1, y1] = at(from);
  const [x2, y2] = at(to);
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  if (hold > 0) await page.waitForTimeout(hold);
  await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 6 });
  await page.mouse.move(x2, y2, { steps: 6 });
  await page.mouse.up();
}

export async function waitScene(page: Page, scene: string) {
  await page.waitForFunction((s) => window.__WGZ__?.scene === s, scene);
}

/** 開遊戲並等到主頁 */
export async function openLobby(page: Page, query = '') {
  await page.goto(`/${query}`);
  await waitScene(page, 'LobbyScene');
}

/**
 * 在出征地圖點第 1 章某一關 → 選隊伍 → 按開戰（T019：沒有等待，直接進戰鬥或結算）。
 * team 沒給就用預設隊伍；有給就把選取調整成剛好這幾隻。
 */
export async function battleFromMap(page: Page, nodeIndex = 0, team?: string[]) {
  await waitScene(page, 'CampaignScene');
  await tap(page, (await wgz(page)).map!.nodes[nodeIndex]);
  await page.waitForFunction(() => !!window.__WGZ__?.map?.stagePanel);
  await tap(page, (await wgz(page)).map!.stagePanel!.go);
  await waitScene(page, 'ExpeditionScene');
  if (team) {
    for (const card of (await wgz(page)).expeditionPanel!.teamCards) {
      if (card.selected !== team.includes(card.id)) await tap(page, card);
    }
    const picked = (await wgz(page)).expeditionPanel!.teamCards.filter((c) => c.selected);
    if (
      picked
        .map((c) => c.id)
        .sort()
        .join() !== [...team].sort().join()
    ) {
      throw new Error(`隊伍沒選對：${picked.map((c) => c.id).join()}`);
    }
  }
  await tap(page, (await wgz(page)).expeditionPanel!.confirmButton!);
}

/** 從主頁進出征地圖，打第 1 章某一關 */
export async function startBattle(page: Page, nodeIndex = 0, team?: string[]) {
  await tap(page, (await wgz(page)).lobby!.buttons.expedition);
  await battleFromMap(page, nodeIndex, team);
}

/** 在主頁打開設定的「略過戰鬥畫面」 */
export async function enableSkipBattle(page: Page) {
  await tap(page, (await wgz(page)).lobby!.buttons.account);
  await page.waitForFunction(() => !!window.__WGZ__?.settings);
  await tap(page, (await wgz(page)).settings!.rects.skipBattle);
  await page.waitForFunction(() => window.__WGZ__?.settings?.values.skipBattle === true);
  await tap(page, (await wgz(page)).settings!.rects.close);
  await page.waitForFunction(() => !window.__WGZ__?.settings);
}
