import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { enableSkipBattle, openLobby, tap, waitScene, wgz } from './helpers';

const SHOTS = 'artifacts/screenshots/landscape';
const act = (name: string) => `#wgz-transfer [data-act="${name}"]`;
const AREA = '#wgz-transfer textarea';

/** 主頁 → 設定 → 存檔搬家，等存檔碼算好 */
async function openTransfer(page: Page) {
  await tap(page, (await wgz(page)).lobby!.buttons.account);
  await page.waitForFunction(() => !!window.__WGZ__?.settings);
  await tap(page, (await wgz(page)).settings!.rects.transfer);
  await page.waitForFunction(() => !!window.__WGZ__?.transfer?.code);
}

const message = (page: Page) => page.evaluate(() => window.__WGZ__!.transfer!.message);

/** 開新遊戲、開略過戰鬥、大耳練一次攻擊（花糧草），讓進度和新遊戲不一樣；不打仗，測試才不會太久 */
async function playABit(page: Page) {
  await openLobby(page);
  await enableSkipBattle(page);
  await tap(page, (await wgz(page)).lobby!.buttons.train);
  await waitScene(page, 'TrainingScene');
  const daer = (await wgz(page)).training!.rows.find((r) => r.id === 'daer')!;
  await tap(page, daer.drill.attack);
  await page.waitForFunction(
    () => window.__WGZ__?.training?.rows.find((r) => r.id === 'daer')?.drill.attack.count === 1,
  );
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
}

test('存檔搬家：複製存檔碼、存成檔案；亂貼或少一截會講原因', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await playABit(page);
  await openTransfer(page);
  const t = (await wgz(page)).transfer!;
  expect(t.code).toMatch(/^WGZ1\.[zr]\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/);
  expect(t.summary).toContain('城主 Lv.1');
  expect(t.canRestore).toBe(false);
  await expect(page.locator(act('restore'))).toBeHidden();
  await page.screenshot({ path: `${SHOTS}/transfer-open.png` });

  // 複製存檔碼
  await page.click(act('copy'));
  await page.waitForFunction(() => window.__WGZ__?.transfer?.message.includes('已複製'));
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(t.code);
  await page.screenshot({ path: `${SHOTS}/transfer-copied.png` });

  // 存成檔案：內容就是存檔碼
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click(act('download')),
  ]);
  expect(download.suggestedFilename()).toMatch(/^wangguozhi-save-\d{8}-\d{4}\.txt$/);
  expect(await readFile(await download.path(), 'utf8')).toBe(t.code);

  // 亂貼、少一截：講得出原因，進度不動
  await page.click(act('load'));
  await page.waitForFunction(() => window.__WGZ__?.transfer?.message.includes('請先把存檔碼'));
  await page.fill(AREA, '這不是存檔碼');
  await page.click(act('load'));
  await page.waitForFunction(() => window.__WGZ__?.transfer?.message.includes('這不是存檔碼'));
  await page.fill(AREA, t.code.slice(0, t.code.length - 25));
  await page.click(act('load'));
  await page.waitForFunction(() => window.__WGZ__?.transfer?.message.includes('不完整'));
  expect((await wgz(page)).transfer!.armed).toBe(false);
  await page.screenshot({ path: `${SHOTS}/transfer-damaged.png` });

  // 關閉回到設定面板
  await page.click(act('close'));
  await page.waitForFunction(() => !window.__WGZ__?.transfer);
  expect((await wgz(page)).settings).toBeTruthy();
});

test('存檔搬家：到全新的瀏覽器貼上讀取，進度一樣；還能還原', async ({ page, browser }) => {
  await playABit(page);
  const played = (await wgz(page)).resources!;
  await openTransfer(page);
  const t = (await wgz(page)).transfer!;
  // 兩個畫面同時開著會很慢，先把原本的關掉
  await page.close();

  // 另一個全新的瀏覽器（沒有存檔）
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await openLobby(p2);
  const fresh = (await wgz(p2)).resources!;
  expect(fresh).not.toEqual(played);
  await openTransfer(p2);
  // 存檔碼被通訊軟體斷行也沒關係
  await p2.fill(AREA, t.code.replace(/(.{60})/g, '$1\n'));
  await p2.click(act('load'));
  await p2.waitForFunction(() => window.__WGZ__?.transfer?.armed === true);
  expect(await message(p2)).toContain('城主 Lv.1');
  await p2.screenshot({ path: `${SHOTS}/transfer-confirm.png` });

  // 改了框框裡的字就要重新檢查
  await p2.locator(AREA).press('End');
  await p2.locator(AREA).pressSequentially('x');
  await p2.waitForFunction(() => window.__WGZ__?.transfer?.armed === false);
  await p2.fill(AREA, t.code);
  await p2.click(act('load'));
  await p2.waitForFunction(() => window.__WGZ__?.transfer?.armed === true);

  // 確定讀取：重新整理後就是那份進度
  await Promise.all([p2.waitForEvent('load'), p2.click(act('load'))]);
  await waitScene(p2, 'LobbyScene');
  let s = await wgz(p2);
  expect(s.save).toEqual({ load: 'ok', saveOk: true });
  expect(s.resources).toEqual(played);
  await tap(p2, s.lobby!.buttons.account);
  await p2.waitForFunction(() => !!window.__WGZ__?.settings);
  expect((await wgz(p2)).settings!.values.skipBattle).toBe(true);
  await tap(p2, (await wgz(p2)).settings!.rects.close);
  await p2.waitForFunction(() => !window.__WGZ__?.settings);
  // 特訓次數也跟著過來
  await tap(p2, (await wgz(p2)).lobby!.buttons.train);
  await waitScene(p2, 'TrainingScene');
  expect((await wgz(p2)).training!.rows.find((r) => r.id === 'daer')!.drill.attack.count).toBe(1);
  await tap(p2, (await wgz(p2)).backButton!);
  await waitScene(p2, 'LobbyScene');

  // 還原讀取前的進度
  await openTransfer(p2);
  expect((await wgz(p2)).transfer!.canRestore).toBe(true);
  await p2.click(act('restore'));
  await p2.waitForFunction(() => window.__WGZ__?.transfer?.restoreArmed === true);
  await p2.screenshot({ path: `${SHOTS}/transfer-restore.png` });
  await Promise.all([p2.waitForEvent('load'), p2.click(act('restore'))]);
  await waitScene(p2, 'LobbyScene');
  s = await wgz(p2);
  expect(s.resources).toEqual(fresh);
  await other.close();
});

test('存檔搬家：剪貼簿不能用時，存檔碼放進框框讓玩家自己複製', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    document.execCommand = () => false;
  });
  await openLobby(page);
  await openTransfer(page);
  const code = (await wgz(page)).transfer!.code;
  await page.click(act('copy'));
  await page.waitForFunction(() => window.__WGZ__?.transfer?.message.includes('沒辦法自動複製'));
  expect(await page.locator(AREA).inputValue()).toBe(code);
  await page.click(act('paste'));
  await page.waitForFunction(() => window.__WGZ__?.transfer?.message.includes('沒辦法自動貼上'));
});

test('存檔搬家：直拿手機時視窗也看得到、按得到', async ({ page }) => {
  await openLobby(page);
  await openTransfer(page);
  // 直拿：遊戲整個轉 90 度，這個視窗是一般網頁、不跟著轉，照直的排
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('html')).toHaveClass(/wgz-rotated/);
  for (const name of ['copy', 'download', 'paste', 'pick', 'load', 'close']) {
    const box = (await page.locator(act(name)).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
  }
  await page.screenshot({ path: 'artifacts/screenshots/portrait/transfer-open.png' });
  await page.click(act('close'));
  await page.waitForFunction(() => !window.__WGZ__?.transfer);
});
