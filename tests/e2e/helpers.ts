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

/**
 * 開遊戲並等到主頁。
 * 體力與每日次數目前預設先放開（src/logic/stamina.ts 的 LIMITS_DEFAULT）；T019 的規則都還在，
 * 所以畫面測試預設加 limits=1 把限制打開照舊驗證。要測「不限體力」的畫面就自己在網址寫 limits=0。
 */
export async function openLobby(page: Page, query = '') {
  if (!query.includes('limits=')) query += `${query ? '&' : '?'}limits=1`;
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
    // 先把不要的拿下來，再把要的放上去：關卡有上陣上限（T018），滿了就加不進去
    for (const wanted of [false, true]) {
      for (const card of (await wgz(page)).expeditionPanel!.teamCards) {
        if (card.selected !== team.includes(card.id) && team.includes(card.id) === wanted) {
          await tap(page, card);
        }
      }
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

/**
 * 把存檔改掉再重開遊戲（測試要直接跳到某個進度時用）。會先進一次組隊畫面再回來，確定存檔已經寫出來。
 * 只在這一頁第一次重開時改一次，之後的重新整理不會再改。
 */
export async function patchSave(page: Page, patch: Record<string, unknown>) {
  await tap(page, (await wgz(page)).lobby!.buttons.team);
  await waitScene(page, 'TeamScene');
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  await page.addInitScript((extra) => {
    if (sessionStorage.getItem('wgz-test-patch')) return;
    const raw = localStorage.getItem('wgz-save');
    if (!raw) return;
    sessionStorage.setItem('wgz-test-patch', '1');
    const file = JSON.parse(raw);
    Object.assign(file.state, extra);
    localStorage.setItem('wgz-save', JSON.stringify(file));
  }, patch);
  await page.reload();
  await waitScene(page, 'LobbyScene');
}
