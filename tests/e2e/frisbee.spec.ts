import { expect, test, type Page } from '@playwright/test';
import { openLobby, tap, waitScene, wgz } from './helpers';

const frisbee = async (page: Page) => (await wgz(page)).frisbee!;

/** 從主頁進訓練場，再進每日小遊戲 */
async function openFrisbee(page: Page) {
  await tap(page, (await wgz(page)).lobby!.buttons.train);
  await waitScene(page, 'TrainingScene');
  await tap(page, (await wgz(page)).training!.minigameButton);
  await waitScene(page, 'FrisbeeScene');
}

/** 把滑鼠移到遊戲座標 x（場地高度的中間） */
async function steer(page: Page, x: number) {
  const box = (await page.locator('canvas').boundingBox())!;
  const s = box.width / 844;
  await page.mouse.move(box.x + x * s, box.y + 240 * s);
}

/**
 * 玩一場：每個飛盤一落地就把滑鼠移到下一個落點（狗狗會自己跑過去）。
 * skip 裡的那幾個故意跑到場地另一頭不接。回傳接到幾個。
 */
async function play(page: Page, skip: number[] = []) {
  await page.waitForFunction(() => window.__WGZ__?.frisbee?.phase === 'play');
  const f = await frisbee(page);
  for (let i = 0; i < f.plan.length; i++) {
    const x = f.plan[i].landX;
    const far = x > 422 ? f.field.x : f.field.x + f.field.width;
    await steer(page, skip.includes(i) ? far : x);
    await page.waitForFunction((n) => window.__WGZ__?.frisbee?.outcomes[n] !== null, i, {
      timeout: 20_000,
    });
  }
  await page.waitForFunction(() => window.__WGZ__?.frisbee?.phase === 'result', null, {
    timeout: 10_000,
  });
  return (await frisbee(page)).result!;
}

test('每日小遊戲接飛盤：選狗、帶狗跑位接飛盤、拿經驗；同一天再玩沒有獎勵', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await tap(page, (await wgz(page)).lobby!.buttons.train);
  await waitScene(page, 'TrainingScene');
  const t = (await wgz(page)).training!;
  // 按鈕在寄宿左邊、不重疊，今天還沒玩所以亮紅點
  expect(t.minigameButton.ready).toBe(true);
  expect(t.minigameButton.x + t.minigameButton.width).toBeLessThanOrEqual(t.boardingButton.x);
  expect(t.minigameButton.height).toBeGreaterThanOrEqual(40);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/frisbee-training.png' });
  await tap(page, t.minigameButton);
  await waitScene(page, 'FrisbeeScene');

  // 開始前：預設主頁那隻，五隻狗都能選
  let f = await frisbee(page);
  expect(f).toMatchObject({ phase: 'intro', ready: true, dogId: 'daer', best: 0, total: 8 });
  expect(f.cells.map((c) => c.id).sort()).toEqual([
    'abai',
    'changxu',
    'daer',
    'heixuan',
    'xiaosuan',
  ]);
  expect(f.reward.max).toBeGreaterThan(f.reward.min);
  for (const r of [...f.cells, f.start]) {
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(844);
    expect(r.y + r.height).toBeLessThanOrEqual(390);
  }
  await tap(
    page,
    f.cells.find((c) => c.id === 'xiaosuan')!,
  );
  await page.waitForFunction(() => window.__WGZ__?.frisbee?.dogId === 'xiaosuan');
  await page.screenshot({ path: 'artifacts/screenshots/landscape/frisbee-intro.png' });

  // 玩一場：故意漏掉第 3 個，其他照落點跑
  await tap(page, (await frisbee(page)).start);
  await page.waitForFunction(() => window.__WGZ__?.frisbee?.outcomes[0] !== undefined);
  await page.waitForFunction(() => (window.__WGZ__?.frisbee?.elapsed ?? 0) > 1500);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/frisbee-play.png' });
  const res = await play(page, [2]);
  f = await frisbee(page);
  expect(f.outcomes[2]).toBe(false);
  // 機器很慢時可能再漏一兩個，但大部分接得到；獎勵照實際接到的數量算
  expect(res.catches).toBeGreaterThanOrEqual(5);
  expect(res.catches).toBeLessThanOrEqual(7);
  expect(res).toMatchObject({ rewarded: true, newBest: true, snack: null, fromLevel: 1 });
  const per = (f.reward.max - f.reward.min) / 8;
  expect(res.exp).toBe(Math.round(f.reward.min + per * res.catches));
  expect(res.toLevel).toBeGreaterThan(1);
  expect(f).toMatchObject({ ready: false, best: res.catches });
  await page.screenshot({ path: 'artifacts/screenshots/landscape/frisbee-result.png' });

  // 再玩一次：沒有獎勵，等級不變
  await tap(page, res.again);
  const again = await play(page);
  expect(again).toMatchObject({ rewarded: false, exp: 0, snack: null });
  expect(again.catches).toBeGreaterThanOrEqual(6);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/frisbee-again.png' });

  // 回訓練場：紅點沒了，小算升級了；重新整理後還是今天玩過
  await tap(page, again.back);
  await waitScene(page, 'TrainingScene');
  const after = (await wgz(page)).training!;
  expect(after.minigameButton.ready).toBe(false);
  expect(after.rows.find((r) => r.id === 'xiaosuan')!.level).toBe(res.toLevel);
  await page.reload();
  await waitScene(page, 'LobbyScene');
  await openFrisbee(page);
  f = await frisbee(page);
  expect(f).toMatchObject({ phase: 'intro', ready: false });
  expect(f.best).toBeGreaterThanOrEqual(res.catches);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/frisbee-played.png' });
});
