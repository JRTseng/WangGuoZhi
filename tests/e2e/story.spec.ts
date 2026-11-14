import { expect, test } from '@playwright/test';
import { openLobby, tap, waitScene, wgz } from './helpers';

test('劇情回顧：序章可看，其餘上鎖；看完紅點消失', async ({ page }) => {
  await openLobby(page);
  await tap(page, (await wgz(page)).lobby!.buttons.story);
  await waitScene(page, 'StoryScene');
  let s = (await wgz(page)).story!;
  expect(s.mode).toBe('list');
  expect(s.items.map((i) => i.unlocked)).toEqual([true, false, false, false, false]);
  await page.screenshot({ path: 'artifacts/screenshots/landscape/story-list.png' });

  // 上鎖的點了沒反應
  await tap(page, s.items[1]);
  expect((await wgz(page)).story!.mode).toBe('list');

  await tap(page, s.items[0]);
  await page.waitForFunction(() => window.__WGZ__?.story?.playing === 'prologue');
  await tap(page, { x: 100, y: 300, width: 0, height: 0 });
  await page.waitForFunction(() => window.__WGZ__?.story?.line === 1);
  s = (await wgz(page)).story!;
  await tap(page, s.skip!);
  await page.waitForFunction(() => window.__WGZ__?.story?.mode === 'list');

  await tap(page, (await wgz(page)).backButton!);
  await waitScene(page, 'LobbyScene');
});
