import { describe, expect, it } from 'vitest';
import {
  MIN_TAP,
  layoutGrid,
  layoutList,
  layoutPath,
  rectInside,
  rectsOverlap,
  tapPad,
  tapRect,
} from './layout';

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

describe('layoutGrid', () => {
  it('8 格分 3 欄：不重疊、都在區域內', () => {
    const rects = layoutGrid(8, { area, columns: 3, gap: 10, maxCellHeight: 150 });
    expect(rects).toHaveLength(8);
    for (const r of rects) expect(rectInside(r, area)).toBe(true);
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++)
        expect(rectsOverlap(rects[i], rects[j])).toBe(false);
    expect(rects[3].x).toBe(rects[0].x);
    expect(rects[3].y).toBeGreaterThan(rects[0].y);
  });
  it('0 格回傳空陣列', () => {
    expect(layoutGrid(0, { area, columns: 3, gap: 10, maxCellHeight: 150 })).toEqual([]);
  });
});

describe('layoutPath', () => {
  const mapArea = { x: 40, y: 100, width: 300, height: 600 };
  it('直式由下往上，左右交錯，頭尾在中線', () => {
    const pts = layoutPath(5, mapArea, false);
    for (let i = 1; i < pts.length; i++) expect(pts[i].y).toBeLessThan(pts[i - 1].y);
    expect(pts[0].x).toBe(190);
    expect(pts[4].x).toBe(190);
    expect(pts[1].x).toBeLessThan(190);
    expect(pts[2].x).toBeGreaterThan(190);
  });
  it('橫式由左往右，都在區域內', () => {
    const pts = layoutPath(5, mapArea, true);
    for (let i = 1; i < pts.length; i++) expect(pts[i].x).toBeGreaterThan(pts[i - 1].x);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(mapArea.x);
      expect(p.x).toBeLessThanOrEqual(mapArea.x + mapArea.width);
      expect(p.y).toBeGreaterThanOrEqual(mapArea.y);
      expect(p.y).toBeLessThanOrEqual(mapArea.y + mapArea.height);
    }
  });
});

describe('tapRect（T008 手指好按的最小範圍）', () => {
  it('比 44 小的邊以中心往外補', () => {
    expect(tapRect({ x: 100, y: 60, width: 52, height: 28 })).toEqual({
      x: 100,
      y: 52,
      width: 52,
      height: 44,
    });
    expect(tapRect({ x: 10, y: 10, width: 10, height: 20 })).toEqual({
      x: -7,
      y: -2,
      width: 44,
      height: 44,
    });
  });

  it('夠大的不動，也可以指定別的大小', () => {
    const r = { x: 0, y: 0, width: 120, height: 48 };
    expect(tapRect(r)).toEqual(r);
    expect(tapRect(r, 60).height).toBe(60);
    expect(tapPad(28)).toBe(8);
    expect(tapPad(44)).toBe(0);
    expect(MIN_TAP).toBe(44);
  });
});
