import { expect, test, type Page } from '@playwright/test';
import { drag, openLobby, tap, waitScene, wgz } from './helpers';

/**
 * T008 手機畫面與觸控：
 * 畫布照實體像素畫（版面仍是 844 x 390）、按鈕的可點範圍至少 44、畫質切換會換解析度。
 */

/** 目前畫面上可點的東西裡，可點範圍比 min 小的（整個畫面的遮罩不算） */
const smallTargets = (page: Page, min: number) =>
  page.evaluate((m) => {
    const game = window.__WGZ_GAME__!;
    const out: string[] = [];
    for (const sc of game.scene.getScenes(true)) {
      const list = (sc.input as unknown as { _list: Phaser.GameObjects.GameObject[] })._list;
      for (const go of list) {
        const o = go as Phaser.GameObjects.Container;
        const area = o.input?.hitArea as { width?: number; height?: number } | undefined;
        if (!o.input?.enabled || !area?.width || !area.height) continue;
        let seen = o.visible;
        for (let p = o.parentContainer; p; p = p.parentContainer) seen = seen && p.visible;
        if (!seen) continue;
        const t = o.getWorldTransformMatrix();
        const w = area.width * t.scaleX;
        const h = area.height * t.scaleY;
        if (Math.min(w, h) < m)
          out.push(`${o.type}@${Math.round(t.tx)},${Math.round(t.ty)} ${w}x${h}`);
      }
    }
    return out;
  }, min);

const go = async (page: Page, key: string) => {
  await page.evaluate((k) => {
    window.__WGZ_GAME__!.scene.getScenes(true)[0].scene.start(k);
  }, key);
  await waitScene(page, key);
};

test('各畫面的按鈕都夠大，手指按得到', async ({ page }) => {
  await openLobby(page, '?fast=1');
  expect(await smallTargets(page, 44)).toEqual([]);
  for (const key of [
    'TeamScene',
    'TrainingScene',
    'BoardingScene',
    'GearScene',
    'QuestScene',
    'SigninScene',
    'RecruitScene',
    'CampaignScene',
    'StoryScene',
  ]) {
    await go(page, key);
    expect(await smallTargets(page, 44), key).toEqual([]);
  }
  // 設定面板的六個開關緊貼著排，一列 35
  await go(page, 'LobbyScene');
  await tap(page, (await wgz(page)).lobby!.buttons.account);
  await page.waitForFunction(() => !!window.__WGZ__?.settings);
  expect(await smallTargets(page, 35)).toEqual([]);
});

// 測試機沒有顯示卡，畫大張很慢：用 1.5 倍驗證就夠了，流程也盡量短
test('高解析度：畫布變大、版面不變，點按與拖曳照常', async ({ page }) => {
  test.setTimeout(240_000);
  await openLobby(page, '?fast=1&res=1.5');
  const s = await wgz(page);
  expect(s.renderScale).toBe(1.5);
  expect(s.size).toEqual({ width: 844, height: 390 });
  expect(
    await page.locator('canvas').evaluate((c: HTMLCanvasElement) => [c.width, c.height]),
  ).toEqual([1266, 585]);
  const box = await page.locator('canvas').boundingBox();
  expect(box!.width).toBeCloseTo(844, 0);
  await page.screenshot({ path: 'artifacts/screenshots/T008/lobby-hires.png' });

  // 組隊：把沒上場的狗拖到空格上
  await tap(page, s.lobby!.buttons.team);
  await waitScene(page, 'TeamScene');
  const team = (await wgz(page)).team!;
  const before = team.dogs.filter((d) => d.inTeam).length;
  const bench = team.dogs.find((d) => d.owned && !d.inTeam && !d.busy && d.visible)!;
  const free = team.slots.find((x) => !x.id)!;
  await drag(page, bench, free, 3000);
  await page.waitForFunction(
    (n) => window.__WGZ__!.team!.dogs.filter((d) => d.inTeam).length === n + 1,
    before,
  );
  await page.screenshot({ path: 'artifacts/screenshots/T008/team-hires.png' });
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
});

test.describe('畫質決定解析度', () => {
  test.use({ deviceScaleFactor: 2 });

  test('切到低就用 1 倍，切回高就照螢幕', async ({ page }) => {
    test.setTimeout(240_000);
    // res=auto：不套用「測試固定 1 倍」，照這台（2 倍螢幕）實際算
    await openLobby(page, '?fast=1&res=auto');
    expect((await wgz(page)).renderScale).toBe(2);
    const width = () => page.locator('canvas').evaluate((c: HTMLCanvasElement) => c.width);
    expect(await width()).toBe(1688);

    await tap(page, (await wgz(page)).lobby!.buttons.account);
    await page.waitForFunction(() => !!window.__WGZ__?.settings);
    await page.screenshot({ path: 'artifacts/screenshots/T008/settings-hires.png' });
    await tap(page, (await wgz(page)).settings!.rects.low);
    // 換了解析度主頁會重畫，設定面板接著開著
    await page.waitForFunction(
      () => window.__WGZ__?.renderScale === 1 && !!window.__WGZ__?.settings,
    );
    expect(await width()).toBe(844);
    expect((await wgz(page)).settings!.values.quality).toBe('low');

    await tap(page, (await wgz(page)).settings!.rects.high);
    await page.waitForFunction(
      () => window.__WGZ__?.renderScale === 2 && !!window.__WGZ__?.settings,
    );
    expect(await width()).toBe(1688);
    await tap(page, (await wgz(page)).settings!.rects.close);
    await page.waitForFunction(() => !window.__WGZ__?.settings);
    // 換過解析度後主頁照常能點
    await tap(page, (await wgz(page)).lobby!.buttons.team);
    await waitScene(page, 'TeamScene');
  });
});

test('遊戲畫面放在安全範圍裡，長按不會選到字', async ({ page }) => {
  await openLobby(page, '?fast=1');
  const css = await page.evaluate(() => {
    const frame = document.getElementById('frame')!;
    const body = getComputedStyle(document.body);
    return {
      inFrame: !!frame.querySelector('#game canvas'),
      position: getComputedStyle(frame).position,
      userSelect: body.userSelect,
      touchAction: body.touchAction,
    };
  });
  expect(css).toEqual({
    inFrame: true,
    position: 'fixed',
    userSelect: 'none',
    touchAction: 'none',
  });
});
