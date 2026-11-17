import { expect, test } from '@playwright/test';
import { drag, openLobby, tap, waitScene, wgz } from './helpers';

const SHOTS = 'artifacts/screenshots/home';
const home = async (page: Parameters<typeof wgz>[0]) => (await wgz(page)).home!;

test('我的家：主頁腳印按鈕進來，屋內與庭院、住戶、家具、風格', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await tap(page, (await wgz(page)).lobby!.buttons.home);
  await waitScene(page, 'HomeScene');
  let h = await home(page);
  expect(h.area).toBe('indoor');
  expect(h.style).toBe('meadow');
  // 沒選過住戶：先住目前的隊伍
  expect(h.residents.length).toBeGreaterThan(0);
  expect(h.residents.length).toBeLessThanOrEqual(5);
  // 汪國一開始屋內沒有貓跳台
  expect(h.pieces.map((p) => p.id)).toContain('sofa');
  expect(h.pieces.map((p) => p.id)).not.toContain('cattree');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/indoor.png` });

  // 住戶：五隻都住進來
  await tap(page, h.buttons.residents);
  await page.waitForFunction(() => window.__WGZ__?.home?.modal?.kind === 'residents');
  for (;;) {
    const m = (await home(page)).modal!;
    const off = m.cells.find((c) => !c.on);
    if (!off || m.cells.filter((c) => c.on).length >= 5) break;
    await tap(page, off);
    await page.waitForFunction(
      (id) => window.__WGZ__?.home?.modal?.cells.find((c) => c.id === id)?.on === true,
      off.id,
    );
  }
  await page.screenshot({ path: `${SHOTS}/modal-residents.png` });
  await tap(page, (await home(page)).modal!.close);
  await page.waitForFunction(() => window.__WGZ__?.home?.residents.length === 5);

  // 家具：把貓跳台擺出來
  await tap(page, (await home(page)).buttons.furniture);
  await page.waitForFunction(() => window.__WGZ__?.home?.modal?.kind === 'furniture');
  let m = (await home(page)).modal!;
  expect(m.cells).toHaveLength(25);
  await tap(
    page,
    m.cells.find((c) => c.id === 'cattree')!,
  );
  await page.waitForFunction(
    () => window.__WGZ__?.home?.modal?.cells.find((c) => c.id === 'cattree')?.on === true,
  );
  await page.screenshot({ path: `${SHOTS}/modal-furniture.png` });
  await tap(page, (await home(page)).modal!.close);
  await page.waitForFunction(
    () =>
      !window.__WGZ__?.home?.modal && window.__WGZ__?.home?.pieces.some((p) => p.id === 'cattree'),
  );

  // 拖家具：貓跳台往左下搬，位置會存起來
  h = await home(page);
  const tree = h.pieces.find((p) => p.id === 'cattree')!;
  const to = { x: tree.x - 200, y: tree.y + 70, width: tree.width, height: tree.height };
  await drag(page, tree, to);
  await page.waitForFunction(
    (x) =>
      Math.abs((window.__WGZ__?.home?.pieces.find((p) => p.id === 'cattree')?.x ?? 0) - x) < 30,
    to.x,
  );
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('wgz-save')!).state.home.placed.cattree,
  );
  expect(saved.x).toBeLessThan(0.7);

  // 風格：十五種，換成雪地木屋
  await tap(page, (await home(page)).buttons.style);
  await page.waitForFunction(() => window.__WGZ__?.home?.modal?.kind === 'style');
  m = (await home(page)).modal!;
  expect(m.cells).toHaveLength(15);
  await page.screenshot({ path: `${SHOTS}/modal-style.png` });
  await tap(
    page,
    m.cells.find((c) => c.id === 'snow')!,
  );
  await page.waitForFunction(() => window.__WGZ__?.home?.style === 'snow');
  await tap(page, (await home(page)).modal!.close);
  await page.waitForFunction(() => !window.__WGZ__?.home?.modal);

  // 去庭院：泳池、飛盤、球球
  await tap(page, (await home(page)).buttons.area);
  await page.waitForFunction(() => window.__WGZ__?.home?.area === 'yard');
  h = await home(page);
  for (const id of ['pool', 'frisbee', 'ball']) expect(h.pieces.map((p) => p.id)).toContain(id);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/yard-snow.png` });

  // 回主頁再進來：場景、風格、住戶都記得
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
  await page.reload();
  await waitScene(page, 'LobbyScene');
  await tap(page, (await wgz(page)).lobby!.buttons.home);
  await waitScene(page, 'HomeScene');
  h = await home(page);
  expect(h.area).toBe('yard');
  expect(h.style).toBe('snow');
  expect(h.residents).toHaveLength(5);
});

test('我的家：喵國是貓腳印，屋內一開始就有貓跳台', async ({ page }) => {
  await openLobby(page, '?fast=1&faction=cat');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/lobby-cat.png` });
  await tap(page, (await wgz(page)).lobby!.buttons.home);
  await waitScene(page, 'HomeScene');
  const h = await home(page);
  expect(h.pieces.map((p) => p.id)).toContain('cattree');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/indoor-cat.png` });
});
