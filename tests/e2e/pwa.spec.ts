import { expect, test } from '@playwright/test';
import { openLobby, tap, waitScene, wgz } from './helpers';

// 手機 App 化（T012）：可以加到主畫面、離線可開

test('有 App 資訊檔與圖示，設定成全螢幕橫向', async ({ page, request }) => {
  await page.goto('/?stay=boot');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const res = await request.get(new URL(href!, page.url()).href);
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.name).toBe('汪國志');
  expect(manifest.display).toBe('fullscreen');
  expect(manifest.orientation).toBe('landscape');
  expect(manifest.start_url).toBe('./');

  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons as { src: string }[]) {
    const img = await request.get(new URL(icon.src, res.url()).href);
    expect(img.ok(), icon.src).toBe(true);
    expect(img.headers()['content-type']).toContain('image/png');
  }
  // iPhone 用的圖示
  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect((await request.get(new URL(apple!, page.url()).href)).ok()).toBe(true);
});

test('自動化測試預設不啟用離線快取', async ({ page }) => {
  await openLobby(page, '?fast=1');
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations())).toHaveLength(0);
});

test('開過一次以後，沒有網路也能開遊戲', async ({ page, context }) => {
  await openLobby(page, '?fast=1&sw=1');
  // 等離線快取裝好並接手這一頁
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, {
    timeout: 60_000,
  });
  const version = (await wgz(page)).version;

  await context.setOffline(true);
  await page.reload();
  await waitScene(page, 'LobbyScene');
  expect((await wgz(page)).version).toBe(version);
  // 圖示與 App 資訊檔離線也拿得到
  const offline = await page.evaluate(async () => {
    const out: Record<string, boolean> = {};
    for (const f of ['manifest.webmanifest', 'icons/icon-192.png']) {
      out[f] = await fetch(f).then(
        (r) => r.ok,
        () => false,
      );
    }
    return out;
  });
  expect(offline).toEqual({ 'manifest.webmanifest': true, 'icons/icon-192.png': true });
  await page.screenshot({ path: 'artifacts/screenshots/T012/offline-lobby.png' });

  // 離線時照常能玩：進組隊再回來
  await tap(page, (await wgz(page)).lobby!.buttons.team);
  await waitScene(page, 'TeamScene');
  await context.setOffline(false);
});

test('一般瀏覽器不能安裝時，設定面板沒有「加到主畫面」', async ({ page }) => {
  await openLobby(page, '?fast=1');
  await tap(page, (await wgz(page)).lobby!.buttons.account);
  await page.waitForFunction(() => !!window.__WGZ__?.settings);
  expect((await wgz(page)).settings!.rects.install).toBeUndefined();
});

test.describe('iPhone', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });

  test('設定面板有「加到主畫面」，按了教玩家怎麼加', async ({ page }) => {
    await openLobby(page, '?fast=1');
    await tap(page, (await wgz(page)).lobby!.buttons.account);
    await page.waitForFunction(() => !!window.__WGZ__?.settings);
    const install = (await wgz(page)).settings!.rects.install;
    expect(install).toBeTruthy();
    expect(install.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: 'artifacts/screenshots/T012/settings-install.png' });

    await tap(page, install);
    await page.waitForFunction(() => window.__WGZ__?.settings?.message.includes('加入主畫面'));
    await page.screenshot({ path: 'artifacts/screenshots/T012/settings-install-hint.png' });
  });
});
