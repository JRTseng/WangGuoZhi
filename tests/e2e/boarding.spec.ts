import { expect, test, type Page } from '@playwright/test';
import { openLobby, tap, waitScene, wgz } from './helpers';

/** 從主頁進訓練場，再進板凳寄宿 */
async function openBoarding(page: Page) {
  await tap(page, (await wgz(page)).lobby!.buttons.train);
  await waitScene(page, 'TrainingScene');
  await tap(page, (await wgz(page)).training!.boardingButton);
  await waitScene(page, 'BoardingScene');
}

const boarding = async (page: Page) => (await wgz(page)).boarding!;

/** 按名單上某隻狗的「寄宿」，等牠出現在寄宿位 */
async function boardDog(page: Page, id: string) {
  const row = (await boarding(page)).rows.find((r) => r.id === id)!;
  expect(row.block).toBeNull();
  await tap(page, row.button);
  await page.waitForFunction(
    (dogId) => window.__WGZ__?.boarding?.slots.some((s) => s.id === dogId),
    id,
  );
}

/**
 * 假裝過了一段時間：重新整理時，在遊戲讀檔前把存檔裡的寄宿時間往前挪（只做一次），
 * 也可以順便改掉存檔的其他欄位。等於「關掉遊戲，過一陣子再開」。
 */
async function reloadLater(page: Page, ms: number, patch: Record<string, unknown> = {}) {
  await page.addInitScript(
    ([shift, extra]) => {
      if (sessionStorage.getItem('wgz-test-later')) return;
      const raw = localStorage.getItem('wgz-save');
      if (!raw) return;
      sessionStorage.setItem('wgz-test-later', '1');
      const file = JSON.parse(raw);
      Object.assign(file.state, extra);
      for (const b of file.state.boarding) {
        b.since -= shift as number;
        b.at -= shift as number;
      }
      localStorage.setItem('wgz-save', JSON.stringify(file));
    },
    [ms, patch] as const,
  );
  await page.reload();
  await waitScene(page, 'LobbyScene');
}

test('板凳寄宿：放進去慢慢拿經驗，離線也算；寄宿中不能上陣，可以接回', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await tap(page, (await wgz(page)).lobby!.buttons.train);
  await waitScene(page, 'TrainingScene');
  const button = (await wgz(page)).training!.boardingButton;
  expect(button).toMatchObject({ count: 0, slots: 2 });
  expect(button.x + button.width).toBeLessThanOrEqual(844);
  expect(button.height).toBeGreaterThanOrEqual(40);
  await tap(page, button);
  await waitScene(page, 'BoardingScene');

  // 兩個空位、第三個還沒開；板凳上的小算、阿白排前面，隊伍裡的三隻不能放
  let b = await boarding(page);
  expect(b.open).toBe(2);
  expect(b.slots.map((s) => s.state)).toEqual(['empty', 'empty', 'locked']);
  expect(
    b.rows
      .map((r) => r.id)
      .slice(0, 2)
      .sort(),
  ).toEqual(['abai', 'xiaosuan']);
  expect(b.rows.map((r) => r.block)).toEqual([null, null, 'in-team', 'in-team', 'in-team']);
  for (const r of [...b.slots, ...b.rows]) {
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(844);
    expect(r.y + r.height).toBeLessThanOrEqual(390);
  }
  for (const r of b.rows) expect(r.button.height).toBeGreaterThanOrEqual(40);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/boarding-empty.png' });

  // 點隊伍裡的狗沒有反應
  await tap(page, b.rows.find((r) => r.id === 'daer')!.button);
  await page.waitForTimeout(150);
  expect((await boarding(page)).slots[0].state).toBe('empty');

  await boardDog(page, 'xiaosuan');
  await boardDog(page, 'abai');
  b = await boarding(page);
  expect(b.slots.map((s) => s.id)).toEqual(['xiaosuan', 'abai', undefined]);
  expect(b.slots[0]).toMatchObject({ state: 'dog', level: 1, levels: 0 });
  expect(b.rows.map((r) => r.id).sort()).toEqual(['changxu', 'daer', 'heixuan']);

  // 測試模式約 3.7 秒 1 點經驗：等一下數字會自己跳
  await page.waitForFunction(() => (window.__WGZ__?.boarding?.slots[0].exp ?? 0) >= 1, null, {
    timeout: 10_000,
  });

  // 關掉遊戲 30 分鐘（測試模式 = 18 場出征的回體時間）再開：18 × 27 = 486 經驗，1 級升到 5 級
  await reloadLater(page, 30 * 60_000);
  await openBoarding(page);
  b = await boarding(page);
  for (const s of b.slots.slice(0, 2)) {
    expect(s.exp).toBeGreaterThanOrEqual(486);
    expect(s.exp).toBeLessThan(486 + 27);
    expect(s).toMatchObject({ level: 5, levels: 4 });
  }
  await page.screenshot({ path: 'artifacts/screenshots/landscape/boarding.png' });

  // 訓練場看得到「寄宿中」與新的等級
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'TrainingScene');
  const t = (await wgz(page)).training!;
  expect(t.boardingButton).toMatchObject({ count: 2, slots: 2 });
  expect(
    t.rows
      .filter((r) => r.boarding)
      .map((r) => r.id)
      .sort(),
  ).toEqual(['abai', 'xiaosuan']);
  expect(t.rows.find((r) => r.id === 'xiaosuan')!.level).toBe(5);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/boarding-training.png' });

  // 組隊：寄宿中的狗有標記，加不進隊伍
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  await tap(page, (await wgz(page)).lobby!.buttons.team);
  await waitScene(page, 'TeamScene');
  let p = (await wgz(page)).picker!;
  expect(
    p.cells
      .filter((c) => c.busy)
      .map((c) => c.id)
      .sort(),
  ).toEqual(['abai', 'xiaosuan']);
  await tap(
    page,
    p.cells.find((c) => c.id === 'xiaosuan')!,
  );
  await page.waitForFunction(() => window.__WGZ__?.team?.panel === 'xiaosuan');
  await page.screenshot({ path: 'artifacts/screenshots/landscape/boarding-team.png' });
  await tap(page, (await wgz(page)).team!.panelButtons!.team!);
  await page.waitForTimeout(150);
  p = (await wgz(page)).picker!;
  expect(p.cells.find((c) => c.id === 'xiaosuan')!.selected).toBe(false);
  expect(p.cells.filter((c) => c.selected)).toHaveLength(3);
  await tap(page, { x: 0, y: 380, width: 844, height: 6 });
  await page.waitForFunction(() => window.__WGZ__?.team?.panel === null);

  // 接回小算：位子空出來，等級留著，又可以再放
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  await openBoarding(page);
  await tap(page, (await boarding(page)).slots[0].button!);
  await page.waitForFunction(() => window.__WGZ__?.boarding?.slots[1].state === 'empty');
  b = await boarding(page);
  expect(b.slots[0]).toMatchObject({ state: 'dog', id: 'abai' });
  expect(b.rows[0]).toMatchObject({ id: 'xiaosuan', level: 5, block: null });
});

test.describe('手機橫放：板凳寄宿', () => {
  const W = 844;
  const H = 390;
  test.use({ viewport: { width: W, height: H } });

  test('通過第 1 章 Boss 後有 3 個寄宿位，橫式排得下、名單可以捲', async ({ page }) => {
    await openLobby(page, '?fast=1');
    await openBoarding(page);
    await boardDog(page, 'xiaosuan');
    await boardDog(page, 'abai');
    // 過 20 分鐘再開，順便把存檔改成「第 1 章打完、補血狗已加入、隊伍只剩大耳」
    await reloadLater(page, 20 * 60_000, {
      cleared: ['luoyepo-1', 'luoyepo-2', 'luoyepo-3', 'luoyepo-4', 'luoyepo-5'],
      owned: ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai', 'nuantong'],
      team: ['daer'],
    });
    await openBoarding(page);
    let b = await boarding(page);
    expect(b.open).toBe(3);
    expect(b.slots.map((s) => s.state)).toEqual(['dog', 'dog', 'empty']);
    // 第 1 章 Boss 一場 180 經驗：12 個週期 × 54
    expect(b.slots[0].exp).toBeGreaterThanOrEqual(648);
    expect(b.slots[0].y).toBe(b.slots[2].y);
    for (const r of b.slots) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(W);
      expect(r.y + r.height).toBeLessThanOrEqual(b.list.y);
    }
    await boardDog(page, 'changxu');
    b = await boarding(page);
    expect(b.slots.map((s) => s.id)).toEqual(['xiaosuan', 'abai', 'changxu']);
    // 位子滿了：剩下沒上陣的顯示沒有空位
    expect(b.rows.find((r) => r.id === 'heixuan')!.block).toBe('full');
    expect(b.rows.find((r) => r.id === 'daer')!.block).toBe('in-team');
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'artifacts/screenshots/landscape/boarding.png' });

    // 接回一隻後，捲到底按最後一列也放得進去
    await tap(page, b.slots[2].button!);
    await page.waitForFunction(() => window.__WGZ__?.boarding?.slots[2].state === 'empty');
    b = await boarding(page);
    if (b.scrollMax > 0) {
      await page.mouse.move(W / 2, b.list.y + b.list.height / 2);
      await page.mouse.wheel(0, 600);
      await page.waitForFunction(
        () => window.__WGZ__?.boarding?.scrollY === window.__WGZ__?.boarding?.scrollMax,
      );
    }
    b = await boarding(page);
    const free = b.rows.filter((r) => r.block === null);
    const last = free[free.length - 1];
    expect(last.button.y).toBeGreaterThanOrEqual(b.list.y);
    expect(last.button.y + last.button.height).toBeLessThanOrEqual(b.list.y + b.list.height);
    await boardDog(page, last.id);
  });
});
