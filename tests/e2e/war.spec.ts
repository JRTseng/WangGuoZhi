import { expect, test, type Page } from '@playwright/test';
import { openLobby, patchSave, tap, waitScene, wgz } from './helpers';

const SHOTS = 'artifacts/screenshots/war';
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(window.localStorage.getItem('wgz-save')!).state);
/** 這一週的星期一（和遊戲同一種算法：當地 05:00 換日） */
const weekOf = (page: Page, daysAgo = 0) =>
  page.evaluate((ago) => {
    const d = new Date(Date.now() - ago * 86_400_000 - 5 * 3_600_000);
    const local = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
    return local.toISOString().slice(0, 10);
  }, daysAgo);

async function openWar(page: Page) {
  await tap(page, (await wgz(page)).lobby!.buttons.faction);
  await waitScene(page, 'WarScene');
}

test('陣營積分戰：兩邊的分數、個人積分獎勵一鍵全領，重開還在', async ({ page }) => {
  await openLobby(page, '?fast=1&faction=dog');
  await openWar(page);
  let w = (await wgz(page)).war!;
  expect(w).toMatchObject({ faction: 'dog', points: 0, claimable: [], hasResult: false });
  expect(w.dog).toBeGreaterThan(0);
  expect(w.cat).toBeGreaterThan(0);
  for (const b of [w.claim, w.switch]) {
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(844);
    expect(b.y + b.height).toBeLessThanOrEqual(390);
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
  const base = w.dog;
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');

  // 這週已經賺了 320 分：前三個門檻可以領
  const s = await saved(page);
  await patchSave(page, {
    war: { week: await weekOf(page), faction: 'dog', points: 320, claimed: [], result: null },
  });
  await openWar(page);
  w = (await wgz(page)).war!;
  expect(w).toMatchObject({ points: 320, claimable: [0, 1, 2] });
  expect(w.dog).toBeGreaterThanOrEqual(base + 320 - 5);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/war.png` });
  await tap(page, w.claim);
  await expect.poll(async () => (await wgz(page)).war!.claimed).toEqual([0, 1, 2]);
  const after = await saved(page);
  expect(after.resources.food).toBe(s.resources.food + 500 + 1000 + 2000);
  expect(after.resources.bones).toBe(s.resources.bones + 10 + 20 + 30);
  expect((await wgz(page)).war!.claimable).toEqual([]);

  await page.reload();
  await waitScene(page, 'LobbyScene');
  expect((await saved(page)).war).toMatchObject({ points: 320, claimed: [0, 1, 2] });
});

test('陣營積分戰：上週有參加，這週進來先領上週的陣營獎勵', async ({ page }) => {
  await openLobby(page, '?fast=1&faction=dog');
  const s = await saved(page);
  // 上週賺了 700 分（比兩邊的差距上限多，所以一定是贏）
  await patchSave(page, {
    war: { week: await weekOf(page, 7), faction: 'dog', points: 700, claimed: [0], result: null },
  });
  await openWar(page);
  const w = (await wgz(page)).war!;
  expect(w).toMatchObject({ points: 0, claimed: [], hasResult: true });
  expect(w.result).toBeTruthy();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/war-result.png` });
  await tap(page, w.result!);
  await expect.poll(async () => (await wgz(page)).war!.hasResult).toBe(false);
  const after = await saved(page);
  expect(after.resources.food).toBe(s.resources.food + 3000);
  expect(after.resources.bones).toBe(s.resources.bones + 100);
  expect(after.war.result).toBeNull();
});
