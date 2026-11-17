import { expect, test, type Page } from '@playwright/test';
import { battleFromMap, openLobby, tap, waitScene, wgz } from './helpers';

const SHOTS = 'artifacts/screenshots/photo';

/** 畫面上有沒有用到圖檔角色的貼圖（全身或頭像） */
const photoImages = (page: Page, scene: string) =>
  page.evaluate((name) => {
    const sc = window.__WGZ_GAME__!.scene.getScene(name);
    let n = 0;
    const walk = (list: unknown[]) => {
      for (const o of list as {
        texture?: { key?: string };
        list?: unknown[];
        visible?: boolean;
      }[]) {
        if (o.texture?.key?.startsWith('photo-lanjue') && o.visible) n += 1;
        if (o.list) walk(o.list);
      }
    };
    walk(sc.children.list);
    return n;
  }, scene);

/** 走一遍主要畫面並截圖；tag 是檔名開頭（new 新圖、old 原本的程式畫法） */
async function tour(page: Page, tag: string, query: string) {
  await openLobby(page, `?fast=1&battle=normal&faction=cat&try=lanjue${query}`);
  expect((await wgz(page)).lobby!.dogId).toBe('lanjue');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/${tag}-lobby.png` });
  const counts: Record<string, number> = { lobby: await photoImages(page, 'LobbyScene') };

  await tap(page, (await wgz(page)).lobby!.buttons.team);
  await waitScene(page, 'TeamScene');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/${tag}-team.png` });
  counts.team = await photoImages(page, 'TeamScene');
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');

  await tap(page, (await wgz(page)).lobby!.buttons.bag);
  await waitScene(page, 'GearScene');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/${tag}-gear.png` });
  counts.gear = await photoImages(page, 'GearScene');
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');

  await tap(page, (await wgz(page)).lobby!.buttons.train);
  await waitScene(page, 'TrainingScene');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/${tag}-training.png` });
  counts.training = await photoImages(page, 'TrainingScene');
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');

  await tap(page, (await wgz(page)).lobby!.buttons.expedition);
  await battleFromMap(page, 0);
  await waitScene(page, 'BattleScene');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/${tag}-battle.png` });
  counts.battle = await photoImages(page, 'BattleScene');
  // 等藍爵放大絕招
  await page.waitForFunction(() => window.__WGZ__?.battle?.ult?.id === 'lanjue', undefined, {
    timeout: 60_000,
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/${tag}-ultimate.png` });
  counts.ult = await photoImages(page, 'BattleScene');
  return counts;
}

test('圖檔角色：藍爵在主頁、組隊、倉庫、訓練場、戰鬥、大絕招都用新圖', async ({ page }) => {
  const c = await tour(page, 'new', '');
  for (const [where, n] of Object.entries(c)) expect(n, where).toBeGreaterThan(0);
  // 大絕招字卡上多一張全身圖
  expect(c.ult).toBeGreaterThan(c.battle);
});

test('圖檔角色：網址加 photo=0 就回到原本的程式畫法', async ({ page }) => {
  const c = await tour(page, 'old', '&photo=0');
  for (const [where, n] of Object.entries(c)) expect(n, where).toBe(0);
});
