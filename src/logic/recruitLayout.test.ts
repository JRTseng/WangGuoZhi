import { describe, expect, it } from 'vitest';
import { rectInside, rectsOverlap, type Rect } from './layout';
import { recruitLayout, resultCells } from './recruitLayout';

const VIEWS = [
  [390, 844, false],
  [844, 390, true],
] as const;

describe('recruitLayout', () => {
  it('看板、結果區、按鈕都在畫面內、互不重疊，按鈕夠大', () => {
    for (const [w, h, landscape] of VIEWS) {
      const l = recruitLayout(w, h, landscape);
      const screen: Rect = { x: 0, y: 56, width: w, height: h - 56 };
      const all = [l.banner, l.results, l.buttons.one, l.buttons.ten];
      for (const r of all) expect(rectInside(r, screen)).toBe(true);
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) expect(rectsOverlap(all[i], all[j])).toBe(false);
      }
      for (const b of [l.buttons.one, l.buttons.ten]) {
        expect(b.height).toBeGreaterThanOrEqual(48);
        expect(b.width).toBeGreaterThanOrEqual(120);
      }
      expect(l.buttons.one.y).toBe(l.buttons.ten.y);
      // 小字在按鈕上面、看板或結果區下面
      expect(l.note.y).toBeLessThan(l.buttons.one.y);
      if (!landscape) expect(l.note.y).toBeGreaterThan(l.results.y + l.results.height);
      else expect(l.note.y).toBeGreaterThan(l.banner.y + l.banner.height);
    }
  });

  it('直式按鈕在最下面，橫式結果在右邊', () => {
    const p = recruitLayout(390, 844, false);
    expect(p.buttons.one.y).toBeGreaterThan(p.results.y + p.results.height);
    expect(p.results.y).toBeGreaterThan(p.banner.y + p.banner.height);
    const l = recruitLayout(844, 390, true);
    expect(l.results.x).toBeGreaterThan(l.banner.x + l.banner.width);
  });
});

describe('resultCells', () => {
  it('十連：10 張都在結果區內、不重疊，一列 5 張', () => {
    for (const [w, h, landscape] of VIEWS) {
      const l = recruitLayout(w, h, landscape);
      const cells = resultCells(l, 10);
      expect(cells).toHaveLength(10);
      for (const c of cells) {
        expect(rectInside(c, l.results)).toBe(true);
        expect(c.width).toBeGreaterThanOrEqual(60);
        expect(c.height).toBeGreaterThanOrEqual(110);
      }
      for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          expect(rectsOverlap(cells[i], cells[j])).toBe(false);
        }
      }
      expect(cells[4].y).toBe(cells[0].y);
      expect(cells[5].y).toBeGreaterThan(cells[0].y);
      expect(cells[5].x).toBe(cells[0].x);
    }
  });

  it('單抽：一張大卡置中', () => {
    for (const [w, h, landscape] of VIEWS) {
      const l = recruitLayout(w, h, landscape);
      const [c] = resultCells(l, 1);
      expect(rectInside(c, l.results)).toBe(true);
      expect(c.x + c.width / 2).toBeCloseTo(l.results.x + l.results.width / 2);
      expect(c.width).toBeGreaterThan(resultCells(l, 10)[0].width);
    }
  });

  it('0 隻就沒有格子', () => {
    expect(resultCells(recruitLayout(390, 844, false), 0)).toEqual([]);
  });
});
