import { expect, test, type Page } from '@playwright/test';

interface R {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 點遊戲座標中某個矩形的中心（FIT 縮放後換算成頁面座標） */
async function tap(page: Page, r: R) {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('找不到 canvas');
  const s = box.width / 390;
  await page.mouse.click(box.x + (r.x + r.width / 2) * s, box.y + (r.y + r.height / 2) * s);
}

const wgz = (page: Page) => page.evaluate(() => window.__WGZ__!);

test('出征完整流程（測試模式：分鐘換成秒）', async ({ page }) => {
  await page.goto('/?fast=1');
  await page.waitForFunction(() => window.__WGZ__?.scene === 'MainScene');

  // 1. 主畫面按「出征」→ 出征面板（選關卡）
  let s = await wgz(page);
  expect(s.expeditionButton?.label).toBe('出征');
  await tap(page, s.expeditionButton!);
  await page.waitForFunction(() => window.__WGZ__?.expeditionPanel?.step === 'stage');
  s = await wgz(page);
  expect(s.expeditionPanel!.stages.map((x) => x.name)).toEqual(['坡腳小徑', '紅葉林', '坡頂哨站']);
  await page.screenshot({ path: 'artifacts/screenshots/expedition-stage.png' });

  // 2. 選第 1 關（5 分鐘 → 測試模式 5 秒）
  await tap(page, s.expeditionPanel!.stages[0]);
  await page.waitForFunction(() => window.__WGZ__?.expeditionPanel?.step === 'team');
  s = await wgz(page);
  expect(s.expeditionPanel!.confirmButton!.enabled).toBe(false);

  // 3. 選 3 隻：大耳、黑旋、長鬚；第 4 隻點了不會被選
  const cards = s.expeditionPanel!.teamCards;
  for (const i of [0, 1, 2, 3]) await tap(page, cards[i]);
  s = await wgz(page);
  expect(s.expeditionPanel!.teamCards.filter((c) => c.selected).map((c) => c.id)).toEqual([
    'daer',
    'heixuan',
    'changxu',
  ]);
  expect(s.expeditionPanel!.confirmButton).toMatchObject({ label: '出發！', enabled: true });
  await page.screenshot({ path: 'artifacts/screenshots/expedition-team.png' });

  // 4. 出發 → 回主畫面倒數中，出征的 3 隻標示出征中
  await tap(page, s.expeditionPanel!.confirmButton!);
  await page.waitForFunction(
    () => window.__WGZ__?.scene === 'MainScene' && !!window.__WGZ__.expedition,
  );
  s = await wgz(page);
  expect(s.expedition!.complete).toBe(false);
  expect(s.expedition!.remainingMs).toBeGreaterThan(3000);
  expect(s.expedition!.remainingMs).toBeLessThanOrEqual(5000);
  expect(s.expeditionButton!.label).toMatch(/^出征中 00:0[1-5]$/);
  expect(s.expeditionButton!.enabled).toBe(false);
  expect(s.cards!.filter((c) => c.busy).map((c) => c.id)).toEqual(['daer', 'heixuan', 'changxu']);
  await page.screenshot({ path: 'artifacts/screenshots/expedition-countdown.png' });

  // 倒數中按按鈕沒反應
  await tap(page, s.expeditionButton!);
  expect((await wgz(page)).scene).toBe('MainScene');

  // 5. 時間到 → 「收成！」
  await page.waitForFunction(() => window.__WGZ__?.expedition?.complete === true, null, {
    timeout: 10_000,
  });
  s = await wgz(page);
  expect(s.expeditionButton).toMatchObject({ label: '收成！', enabled: true });
  await page.screenshot({ path: 'artifacts/screenshots/expedition-ready.png' });

  // 6. 收成 → 資源增加、狗狗釋放、顯示結果
  await tap(page, s.expeditionButton!);
  await page.waitForFunction(() => !!window.__WGZ__?.result);
  s = await wgz(page);
  expect(s.result).toEqual({ food: 120, bones: 5 });
  expect(s.resources).toEqual({ food: 1320, bones: 55 });
  expect(s.expedition).toBeNull();
  expect(s.cards!.every((c) => !c.busy)).toBe(true);
  await page.screenshot({ path: 'artifacts/screenshots/expedition-harvest.png' });

  // 關閉結果 → 按鈕回到「出征」
  await tap(page, { x: 0, y: 300, width: 390, height: 40 });
  await page.waitForFunction(() => window.__WGZ__?.result === null);
  expect((await wgz(page)).expeditionButton!.label).toBe('出征');
});

test('出征面板可返回主畫面', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__WGZ__?.scene === 'MainScene');
  await tap(page, (await wgz(page)).expeditionButton!);
  await page.waitForFunction(() => window.__WGZ__?.expeditionPanel?.step === 'stage');
  const s = await wgz(page);
  await tap(page, s.expeditionPanel!.stages[1]);
  await page.waitForFunction(() => window.__WGZ__?.expeditionPanel?.step === 'team');
  await tap(page, s.backButton!);
  await page.waitForFunction(() => window.__WGZ__?.expeditionPanel?.step === 'stage');
  await tap(page, s.backButton!);
  await page.waitForFunction(() => window.__WGZ__?.scene === 'MainScene');
});

test('卡片與按鈕整塊都點得到（四個角落）', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__WGZ__?.scene === 'MainScene');

  // 出征按鈕右下角
  const btn = (await wgz(page)).expeditionButton!;
  await tap(page, { x: btn.x + btn.width - 30, y: btn.y + btn.height - 14, width: 0, height: 0 });
  await page.waitForFunction(() => window.__WGZ__?.expeditionPanel?.step === 'stage');

  // 關卡卡片右下角
  const stage = (await wgz(page)).expeditionPanel!.stages[0];
  await tap(page, {
    x: stage.x + stage.width - 20,
    y: stage.y + stage.height - 12,
    width: 0,
    height: 0,
  });
  await page.waitForFunction(() => window.__WGZ__?.expeditionPanel?.step === 'team');

  // 前 3 張狗卡分別點不同角落：選到 → 再點取消 → 再點選回來
  const cards = (await wgz(page)).expeditionPanel!.teamCards;
  const spots: [number, number][] = [
    [0.9, 0.85],
    [0.1, 0.85],
    [0.9, 0.15],
  ];
  const selected = (id: string) =>
    page.evaluate(
      (id) => window.__WGZ__?.expeditionPanel?.teamCards.find((x) => x.id === id)?.selected,
      id,
    );
  for (const [i, [fx, fy]] of spots.entries()) {
    const c = cards[i];
    const p = { x: c.x + c.width * fx, y: c.y + c.height * fy, width: 0, height: 0 };
    await tap(page, p);
    expect(await selected(c.id), `第 ${i + 1} 張點 (${fx}, ${fy})`).toBe(true);
    await tap(page, p);
    expect(await selected(c.id)).toBe(false);
    await tap(page, p);
    expect(await selected(c.id)).toBe(true);
  }
  expect((await wgz(page)).expeditionPanel!.confirmButton!.enabled).toBe(true);
});
