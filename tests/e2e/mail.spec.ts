import { expect, test, type Page } from '@playwright/test';
import { openLobby, patchSave, tap, waitScene, wgz } from './helpers';

const W = 844;
const H = 390;
const SHOTS = 'artifacts/screenshots/mail';
const mail = async (page: Page) => (await wgz(page)).mail!;

async function openMail(page: Page) {
  await tap(page, (await wgz(page)).lobby!.buttons.mail);
  await waitScene(page, 'MailScene');
}

test('信箱：主頁進來，看信、領附件、刪信，重新整理後還記得', async ({ page }) => {
  await openLobby(page, '?fast=1');
  // 新遊戲有三封信還沒看，「信箱」亮紅點
  await page.waitForFunction(() => window.__WGZ__?.lobby?.mailReady === 3);
  await page.screenshot({ path: `${SHOTS}/mail-lobby-dot.png` });
  await openMail(page);

  let m = await mail(page);
  expect(m.rows.map((r) => r.kind)).toEqual(['news', 'week', 'welcome']);
  expect(m.pages).toBe(1);
  for (const r of [...m.rows, m.prev, m.next, m.claim, m.remove, m.claimAll, m.clean]) {
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(W);
    expect(r.y + r.height).toBeLessThanOrEqual(H);
    expect(r.height).toBeGreaterThanOrEqual(44);
  }
  // 第一封自動打開、記成看過；附件還沒領所以不能刪
  expect(m.open).toMatchObject({ id: 'news-mailbox', read: true, claimed: false });
  expect(m.claim.enabled).toBe(true);
  expect(m.remove.enabled).toBe(false);
  expect(m.claimAll.count).toBe(3);
  await page.screenshot({ path: `${SHOTS}/mail-new.png` });

  // 點歡迎信，領附件：骨頭幣 +100
  const before = (await wgz(page)).resources!;
  await tap(page, m.rows[2]);
  await page.waitForFunction(() => window.__WGZ__?.mail?.open?.id === 'welcome');
  m = await mail(page);
  expect(m.open!.gifts).toEqual(['骨頭幣 +100', '小肉乾 ×5']);
  await page.screenshot({ path: `${SHOTS}/mail-welcome.png` });
  await tap(page, m.claim);
  await page.waitForFunction(() => window.__WGZ__?.mail?.open?.claimed === true);
  expect((await wgz(page)).resources).toEqual({ food: before.food, bones: before.bones + 100 });
  m = await mail(page);
  expect(m.toast).toBe('領取：骨頭幣 +100、小肉乾 ×5');
  expect(m.claim.enabled).toBe(false);
  expect(m.claimAll.count).toBe(2);
  // 領過的信留在原位，不會跳來跳去
  expect(m.rows.map((r) => r.id)[2]).toBe('welcome');
  await page.screenshot({ path: `${SHOTS}/mail-claimed.png` });
  // 再點一次領取沒有反應
  await tap(page, m.claim);
  await page.waitForTimeout(200);
  expect((await wgz(page)).resources!.bones).toBe(before.bones + 100);

  // 刪掉歡迎信
  await tap(page, m.remove);
  await page.waitForFunction(() => window.__WGZ__?.mail?.ids.length === 2);
  m = await mail(page);
  expect(m.ids).not.toContain('welcome');

  // 回主頁：還有兩封沒領；重新整理後信箱照舊
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  await page.waitForFunction(() => window.__WGZ__?.lobby?.mailReady === 2);
  await page.reload();
  await waitScene(page, 'LobbyScene');
  await openMail(page);
  m = await mail(page);
  expect(m.ids).toHaveLength(2);
  expect(m.ids).not.toContain('welcome');

  // 全部領取，再清掉看過的：信箱空了，主頁紅點消失
  await tap(page, m.claimAll);
  await page.waitForFunction(() => window.__WGZ__?.mail?.claimAll.count === 0);
  m = await mail(page);
  expect(m.toast).toContain('領了 2 封信的附件');
  expect((await wgz(page)).resources!.bones).toBe(before.bones + 100 + 50 + 30);
  // 還有一封沒打開過，先點開
  for (const r of m.rows) {
    await tap(page, r);
    await page.waitForFunction((id) => window.__WGZ__?.mail?.open?.id === id, r.id);
  }
  m = await mail(page);
  expect(m.clean.count).toBe(2);
  await tap(page, m.clean);
  await page.waitForFunction(() => window.__WGZ__?.mail?.ids.length === 0);
  m = await mail(page);
  expect(m.open).toBeNull();
  await page.screenshot({ path: `${SHOTS}/mail-empty.png` });
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  await page.waitForFunction(() => window.__WGZ__?.lobby?.mailReady === 0);
});

test('信箱：打過三章、城主 20 級的存檔有捷報與賀信，超過五封可以換頁', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await patchSave(page, {
    cleared: ['luoyepo-5', 'zhulindu-5', 'xuelingguan-5'],
    lord: { level: 20, exp: 0 },
  });
  await page.waitForFunction(() => window.__WGZ__?.lobby?.mailReady === 8);
  await openMail(page);
  let m = await mail(page);
  expect(m.ids).toHaveLength(8);
  expect(m.pages).toBe(2);
  expect(m.rows).toHaveLength(5);
  expect(m.ids).toEqual(expect.arrayContaining(['chapter-1', 'chapter-3', 'lord-10', 'lord-20']));
  await page.screenshot({ path: `${SHOTS}/mail-many.png` });

  // 下一頁：剩下三封，自動打開那一頁的第一封
  await tap(page, m.next);
  await page.waitForFunction(() => window.__WGZ__?.mail?.page === 1);
  m = await mail(page);
  expect(m.rows).toHaveLength(3);
  expect(m.open!.id).toBe(m.rows[0].id);
  await page.screenshot({ path: `${SHOTS}/mail-page2.png` });
  await tap(page, m.prev);
  await page.waitForFunction(() => window.__WGZ__?.mail?.page === 0);

  // 全部領取：八封一次領完
  await tap(page, (await mail(page)).claimAll);
  await page.waitForFunction(() => window.__WGZ__?.mail?.claimAll.count === 0);
  expect((await mail(page)).toast).toContain('領了 8 封信的附件');
  await page.screenshot({ path: `${SHOTS}/mail-claim-all.png` });
});
