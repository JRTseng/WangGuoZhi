import { describe, expect, it } from 'vitest';
import { layoutList, rectInside, rectsOverlap } from './layout';

const area = { x: 16, y: 120, width: 358, height: 580 };

describe('layoutList', () => {
  it('5 張卡片互不重疊且都在區域內', () => {
    const rects = layoutList(5, { area, gap: 12, maxCardHeight: 104 });
    expect(rects).toHaveLength(5);
    for (const r of rects) expect(rectInside(r, area)).toBe(true);
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++)
        expect(rectsOverlap(rects[i], rects[j])).toBe(false);
  });

  it('區域不夠時縮小卡片而不是超出', () => {
    const small = { ...area, height: 300 };
    const rects = layoutList(5, { area: small, gap: 10, maxCardHeight: 104 });
    expect(rects[0].height).toBeLessThan(104);
    expect(rectInside(rects[4], small)).toBe(true);
  });

  it('0 張回傳空陣列', () => {
    expect(layoutList(0, { area, gap: 12, maxCardHeight: 104 })).toEqual([]);
  });
});

describe('rectsOverlap', () => {
  it('邊緣相接不算重疊', () => {
    expect(
      rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 0, y: 10, width: 10, height: 10 }),
    ).toBe(false);
  });
  it('有交集算重疊', () => {
    expect(
      rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }),
    ).toBe(true);
  });
});
