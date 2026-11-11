import { describe, expect, it } from 'vitest';
import { rectInside, rectsOverlap } from './layout';
import { lobbyLayout, tappableRects } from './lobbyLayout';

const cases = [
  { name: '直式', w: 390, h: 844, landscape: false },
  { name: '橫式', w: 844, h: 390, landscape: true },
];

describe.each(cases)('lobbyLayout $name', ({ w, h, landscape }) => {
  const L = lobbyLayout(w, h, landscape);
  const screen = { x: 0, y: 0, width: w, height: h };
  const rects = Object.entries(tappableRects(L));

  it('所有按鈕都在畫面內', () => {
    for (const [k, r] of rects) expect(rectInside(r, screen), k).toBe(true);
    for (const r of L.resources) expect(rectInside(r, screen)).toBe(true);
  });

  it('按鈕彼此不重疊', () => {
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++)
        expect(rectsOverlap(rects[i][1], rects[j][1]), `${rects[i][0]} / ${rects[j][0]}`).toBe(
          false,
        );
  });

  it('按鈕夠大，手指好按（至少 44）', () => {
    for (const [k, r] of rects) {
      expect(r.width, k).toBeGreaterThanOrEqual(44);
      expect(r.height, k).toBeGreaterThanOrEqual(30);
    }
  });

  it('帳號在左上、選單在左側、出征卡在右側或下方', () => {
    expect(L.account.x).toBeLessThan(40);
    expect(L.account.y).toBeLessThan(40);
    for (const r of Object.values(L.menu)) expect(r.x + r.width).toBeLessThan(w / 2);
    if (landscape) expect(L.expedition.x).toBeGreaterThan(w / 2);
    else expect(L.expedition.y).toBeGreaterThan(h / 2);
    expect(rectInside(L.expedition, L.expeditionCard)).toBe(true);
    expect(rectInside(L.status, L.expeditionCard)).toBe(true);
  });
});
