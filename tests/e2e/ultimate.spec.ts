import { expect, test, type Page } from '@playwright/test';
import { openLobby, startBattle, tap, waitScene, wgz } from './helpers';

const battle = async (page: Page) => (await wgz(page)).battle!;
const LINE = '城主有令，全軍出擊！';

/** 放慢的節奏太慢，切到 ×2：一次出手約 0.8 秒、大絕招約 1.5 秒（和正常 ×1 一樣長） */
async function speedTwo(page: Page) {
  await tap(page, (await battle(page)).speedButton);
  await page.waitForFunction(() => window.__WGZ__?.battle?.speed === 2);
}

/** 等到第 n 次大絕招開始播，再等字卡滑進來 */
async function waitUlt(page: Page, n: number) {
  await page.waitForFunction(
    (k) => window.__WGZ__?.battle?.ults === k && !!window.__WGZ__?.battle?.ult,
    n,
    { timeout: 40_000 },
  );
  const b = await battle(page);
  await page.waitForTimeout(450);
  return b;
}

test('訓練場填台詞，戰鬥中放大絕招會喊招式名與台詞；勝負不變', async ({ page }) => {
  // 流程長（訓練場、重新整理、看兩次大絕招），CI 上超過預設的 60 秒
  test.setTimeout(150_000);
  // &battle=slow：戰鬥放慢，來得及截圖
  await openLobby(page, '?fast=1&battle=slow');
  await tap(page, (await wgz(page)).lobby!.buttons.train);
  await waitScene(page, 'TrainingScene');
  let row = (await wgz(page)).training!.rows.find((r) => r.id === 'daer')!;
  expect(row.skillLine).toMatchObject({ skill: '結義', custom: false });
  expect(row.skillLine.line.length).toBeGreaterThan(0);
  // 按鈕在卡片裡、特訓按鈕上面
  expect(row.skillLine.x + row.skillLine.width).toBeLessThanOrEqual(row.x + row.width);
  expect(row.skillLine.y + row.skillLine.height).toBeLessThan(row.drill.attack.y);

  // 點「改台詞」→ 打字視窗 → 填一句 → 確定
  await tap(page, row.skillLine);
  const prompt = page.locator('#wgz-prompt');
  await expect(prompt).toBeVisible();
  expect((await wgz(page)).training!.lineEditor).toBe(true);
  await expect(prompt).toContainText('大耳的招式台詞');
  await expect(prompt).toContainText('結義');
  const input = prompt.locator('input');
  await expect(input).toHaveAttribute('maxlength', '16');
  await input.fill(LINE);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/skill-line-editor.png' });
  await prompt.locator('button[data-act="ok"]').click();
  await expect(prompt).toHaveCount(0);
  row = (await wgz(page)).training!.rows.find((r) => r.id === 'daer')!;
  expect(row.skillLine).toMatchObject({ line: LINE, custom: true });
  // 沒有不小心按到特訓
  expect(row.drill.attack.count).toBe(0);
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/skill-line-saved.png' });

  // 取消不會改；重新整理後還在（有進存檔）
  await tap(page, row.skillLine);
  await prompt.locator('input').fill('不要這句');
  await prompt.locator('button[data-act="cancel"]').click();
  await expect(prompt).toHaveCount(0);
  await page.reload();
  await waitScene(page, 'LobbyScene');
  await tap(page, (await wgz(page)).lobby!.buttons.train);
  await waitScene(page, 'TrainingScene');
  row = (await wgz(page)).training!.rows.find((r) => r.id === 'daer')!;
  expect(row.skillLine).toMatchObject({ line: LINE, custom: true });
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');

  // 開戰：我方有 EN 條（從 0 開始），野犬沒有
  await startBattle(page);
  await waitScene(page, 'BattleScene');
  let b = await battle(page);
  expect(b.ults).toBe(0);
  expect(b.ult).toBeNull();
  expect(b.ultTotal).toBeGreaterThanOrEqual(1);
  expect(b.team.map((u) => u.en)).toEqual([0, 0, 0]);
  expect(b.enemies.map((u) => u.en)).toEqual([null, null, null]);
  await speedTwo(page);

  // 第一招是大耳（第 3 次出手）：喊「結義」與剛填的台詞；語音掛點有收到提示
  b = await waitUlt(page, 1);
  expect(b.ult).toEqual({ id: 'daer', side: 'team', skill: '結義', line: LINE, kind: 'buff' });
  expect(b.voiceCue).toBe('daer.ultimate');
  expect(b.phase).toBe('playing');
  await page.screenshot({ path: 'artifacts/screenshots/portrait/ultimate-buff.png' });

  // 第二招是黑旋（突擊，穿透），用預設台詞
  b = await waitUlt(page, 2);
  expect(b.ult).toMatchObject({ id: 'heixuan', skill: '怒吼', kind: 'pierce' });
  expect(b.ult!.line.length).toBeGreaterThan(0);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/ultimate-pierce.png' });
  // 字卡滑走、打下去的那一下
  const hitIndex = b.index;
  await page.waitForFunction((i) => (window.__WGZ__?.battle?.index ?? 0) > i, hitIndex);
  await page.screenshot({ path: 'artifacts/screenshots/portrait/ultimate-pierce-hit.png' });
  b = await battle(page);
  for (const u of b.team) {
    expect(u.en).toBeGreaterThanOrEqual(0);
    expect(u.en).toBeLessThanOrEqual(b.enMax);
  }

  // 演出途中略過：結果和原本一模一樣（勝，獎勵 120／5）
  await tap(page, b.skipButton);
  await page.waitForFunction(() => window.__WGZ__?.battle?.phase === 'result');
  b = await battle(page);
  expect(b).toMatchObject({ win: true, skipped: true, ult: null });
  expect(b.index).toBe(b.total);
  expect(b.enemies.every((u) => u.hp === 0)).toBe(true);
  expect((await wgz(page)).result).toEqual({ food: 120, bones: 5, win: true });
});

test.describe('手機橫放', () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test('橫式大絕招演出；整場看完，每一招都有播', async ({ page }) => {
    test.setTimeout(150_000);
    await openLobby(page, '?fast=1&battle=slow');
    await startBattle(page, 0, ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai']);
    await waitScene(page, 'BattleScene');
    await speedTwo(page);
    let b = await waitUlt(page, 1);
    expect(b.ult).toMatchObject({ id: 'daer', side: 'team' });
    await page.screenshot({ path: 'artifacts/screenshots/landscape/ultimate-buff.png' });
    // 小算是謀略：整排
    await page.waitForFunction(
      () =>
        window.__WGZ__?.battle?.ult?.id === 'xiaosuan' ||
        window.__WGZ__?.battle?.phase === 'result',
      null,
      { timeout: 40_000 },
    );
    b = await battle(page);
    if (b.ult) {
      expect(b.ult.kind).toBe('row');
      await page.waitForTimeout(450);
      await page.screenshot({ path: 'artifacts/screenshots/landscape/ultimate-row.png' });
    }
    for (const speed of [3, 4]) {
      await tap(page, b.speedButton);
      await page.waitForFunction((s) => window.__WGZ__?.battle?.speed === s, speed);
    }
    await page.waitForFunction(() => window.__WGZ__?.battle?.phase === 'result', null, {
      timeout: 40_000,
    });
    b = await battle(page);
    expect(b).toMatchObject({ win: true, skipped: false, ult: null });
    expect(b.ults).toBe(b.ultTotal);
    expect(b.ultTotal).toBeGreaterThanOrEqual(3);
    expect((await wgz(page)).result).toEqual({ food: 120, bones: 5, win: true });
  });
});
