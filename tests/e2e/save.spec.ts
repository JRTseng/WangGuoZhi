import { expect, test, type Page } from '@playwright/test';
import { enableSkipBattle, openLobby, startBattle, tap, waitScene, wgz } from './helpers';

const CLOSE = { x: 0, y: 380, width: 844, height: 6 };
const SAVE_KEY = 'wgz-save';

async function openSettings(page: Page) {
  await tap(page, (await wgz(page)).lobby!.buttons.account);
  await page.waitForFunction(() => !!window.__WGZ__?.settings);
}

async function openTraining(page: Page) {
  await tap(page, (await wgz(page)).lobby!.buttons.train);
  await waitScene(page, 'TrainingScene');
}

test('存檔：打一關、特訓、改設定後重新整理，進度都還在', async ({ page }) => {
  // 不開測試模式：體力 5 分鐘才回 1 點，數字不會在測試途中變動
  await openLobby(page);
  expect((await wgz(page)).save).toEqual({ load: 'new', saveOk: true });
  await enableSkipBattle(page);

  // 打贏第 1 關（第一次過關會播劇情）
  await startBattle(page, 0);
  await page.waitForFunction(() => !!window.__WGZ__?.result);
  expect((await wgz(page)).result!.win).toBe(true);
  await tap(page, CLOSE);
  await waitScene(page, 'StoryScene');
  await tap(page, (await wgz(page)).story!.skip!);
  await waitScene(page, 'LobbyScene');

  // 大耳練一次攻擊
  await openTraining(page);
  const row = (await wgz(page)).training!.rows.find((r) => r.id === 'daer')!;
  await tap(page, row.drill.attack);
  await page.waitForFunction(
    () => window.__WGZ__?.training?.rows.find((r) => r.id === 'daer')?.drill.attack.count === 1,
  );
  const before = (await wgz(page)).training!;

  // 重新整理 = 關掉再開
  await page.reload();
  await waitScene(page, 'LobbyScene');
  let s = await wgz(page);
  expect(s.save).toEqual({ load: 'ok', saveOk: true });
  expect(s.resources!.food).toBe(before.food);
  expect(s.resources!.bones).toBeGreaterThan(50);
  expect(s.stamina).toEqual({ value: 80, max: 100 });
  await page.screenshot({ path: 'artifacts/screenshots/landscape/save-reloaded.png' });

  // 設定還在
  await openSettings(page);
  expect((await wgz(page)).settings!.values.skipBattle).toBe(true);
  await tap(page, (await wgz(page)).settings!.rects.close);
  await page.waitForFunction(() => !window.__WGZ__?.settings);

  // 等級、經驗、特訓次數還在
  await openTraining(page);
  const after = (await wgz(page)).training!;
  expect(after.food).toBe(before.food);
  for (const b of before.rows) {
    const a = after.rows.find((r) => r.id === b.id)!;
    expect([a.level, a.exp, a.attack, a.defense]).toEqual([b.level, b.exp, b.attack, b.defense]);
    expect(a.drill.attack.count).toBe(b.drill.attack.count);
  }
  expect(after.rows.find((r) => r.id === 'daer')!.drill.attack.count).toBe(1);
  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');

  // 通關進度與今天的出征次數還在
  await tap(page, (await wgz(page)).lobby!.buttons.expedition);
  await waitScene(page, 'CampaignScene');
  s = await wgz(page);
  expect(s.map!.nodes[0].state).toBe('cleared');
  expect(s.map!.nodes[1].state).toBe('open');
  await tap(page, s.map!.nodes[0]);
  await page.waitForFunction(() => !!window.__WGZ__?.map?.stagePanel);
  await tap(page, (await wgz(page)).map!.stagePanel!.go);
  await waitScene(page, 'ExpeditionScene');
  expect((await wgz(page)).expeditionPanel!.runsLeft).toBe(2);
});

test('存檔：壞檔會自動重置，並留一份備份', async ({ page }) => {
  await page.addInitScript((key) => {
    // 只在第一次開頁面時放壞檔；重新整理不再放
    if (!window.sessionStorage.getItem('seeded')) {
      window.sessionStorage.setItem('seeded', '1');
      window.localStorage.setItem(key, '{這不是存檔');
    }
  }, SAVE_KEY);
  await openLobby(page);
  let s = await wgz(page);
  expect(s.save).toEqual({ load: 'reset', saveOk: true });
  expect(s.resources).toEqual({ food: 1200, bones: 50 });
  await page.screenshot({ path: 'artifacts/screenshots/landscape/save-broken-reset.png' });
  expect(await page.evaluate(() => window.localStorage.getItem('wgz-save-broken'))).toBe(
    '{這不是存檔',
  );

  // 重置後已經存成正常的新遊戲，再開一次就是讀檔
  await page.reload();
  await waitScene(page, 'LobbyScene');
  s = await wgz(page);
  expect(s.save).toEqual({ load: 'ok', saveOk: true });
});

test('存檔：舊存檔缺新欄位照樣讀得進來', async ({ page }) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        state: { resources: { food: 4321, bones: 99 }, cleared: ['luoyepo-1'] },
      }),
    );
  }, SAVE_KEY);
  await openLobby(page);
  const s = await wgz(page);
  expect(s.save!.load).toBe('ok');
  expect(s.resources).toEqual({ food: 4321, bones: 99 });
  expect(s.stamina).toEqual({ value: 100, max: 100 });
});

test('設定的「重新開始」要按兩次才會清除存檔', async ({ page }) => {
  await openLobby(page);
  await enableSkipBattle(page);
  await startBattle(page, 0);
  await page.waitForFunction(() => !!window.__WGZ__?.result);
  await tap(page, CLOSE);
  await waitScene(page, 'StoryScene');
  await tap(page, (await wgz(page)).story!.skip!);
  await waitScene(page, 'LobbyScene');
  expect((await wgz(page)).stamina!.value).toBe(80);

  // 按一次只是提醒；做別的事就取消
  await openSettings(page);
  await tap(page, (await wgz(page)).settings!.rects.reset);
  await page.waitForFunction(() => window.__WGZ__?.settings?.resetArmed === true);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/settings-reset-confirm.png' });
  await tap(page, (await wgz(page)).settings!.rects.music);
  await page.waitForFunction(() => window.__WGZ__?.settings?.resetArmed === false);
  expect((await wgz(page)).stamina!.value).toBe(80);

  // 連按兩次才清除，回到新遊戲
  await tap(page, (await wgz(page)).settings!.rects.reset);
  await page.waitForFunction(() => window.__WGZ__?.settings?.resetArmed === true);
  await Promise.all([
    page.waitForEvent('load'),
    tap(page, (await wgz(page)).settings!.rects.reset),
  ]);
  await waitScene(page, 'LobbyScene');
  const s = await wgz(page);
  expect(s.stamina).toEqual({ value: 100, max: 100 });
  expect(s.resources).toEqual({ food: 1200, bones: 50 });
  await tap(page, s.lobby!.buttons.expedition);
  await waitScene(page, 'CampaignScene');
  expect((await wgz(page)).map!.nodes[0].state).toBe('open');
});

test('橫式：設定面板的重新開始與關閉並排', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openLobby(page);
  await openSettings(page);
  const r = (await wgz(page)).settings!.rects;
  expect(r.reset.y).toBe(r.close.y);
  expect(r.reset.x + r.reset.width).toBeLessThan(r.close.x);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/settings-reset.png' });
});
