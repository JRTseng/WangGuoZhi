import { describe, expect, it } from 'vitest';
import { FRISBEE_PICK_COLUMNS, fieldFrac, fieldX, fieldY, frisbeeLayout } from './frisbeeLayout';

const W = 844;
const H = 390;

describe('接飛盤的排版', () => {
  it('場地、計分與視窗都在畫面裡', () => {
    const l = frisbeeLayout(W, H, 30);
    expect(l.field.x).toBeGreaterThan(0);
    expect(l.field.x + l.field.width).toBeLessThan(W);
    expect(l.field.y).toBeGreaterThan(56);
    expect(l.field.y + l.field.height).toBeLessThan(l.groundY);
    expect(l.groundY).toBeLessThan(H);
    expect(l.panel.y).toBeGreaterThanOrEqual(56);
    expect(l.panel.y + l.panel.height).toBeLessThanOrEqual(H);
    expect(l.start.x + l.start.width).toBeLessThanOrEqual(l.panel.x + l.panel.width);
    expect(l.start.y + l.start.height).toBeLessThanOrEqual(l.panel.y + l.panel.height);
    expect(l.start.height).toBeGreaterThanOrEqual(44);
  });

  it('選狗格子排成一列 10 格、不會疊到右邊的開始按鈕；狗多了格子變小還是排得下', () => {
    for (const n of [5, 30, 50]) {
      const l = frisbeeLayout(W, H, n);
      expect(l.cells).toHaveLength(n);
      expect(l.cells[0].y).toBe(l.cells[Math.min(n, FRISBEE_PICK_COLUMNS) - 1].y);
      for (const c of l.cells) {
        expect(c.x).toBeGreaterThanOrEqual(l.panel.x);
        expect(c.x + c.width).toBeLessThanOrEqual(l.start.x);
        expect(c.y + c.height).toBeLessThanOrEqual(l.panel.y + l.panel.height);
      }
    }
    expect(frisbeeLayout(W, H, 30).cells[0].width).toBeGreaterThanOrEqual(44);
    expect(frisbeeLayout(W, H, 0).cells).toEqual([]);
  });

  it('場地比例和畫面座標互換', () => {
    const l = frisbeeLayout(W, H, 5);
    expect(fieldX(l, 0)).toBe(l.field.x);
    expect(fieldX(l, 1)).toBe(l.field.x + l.field.width);
    expect(fieldFrac(l, fieldX(l, 0.3))).toBeCloseTo(0.3);
    expect(fieldFrac(l, -50)).toBe(0);
    expect(fieldFrac(l, W + 50)).toBe(1);
    expect(fieldY(l, 0)).toBe(l.field.y + l.field.height);
    expect(fieldY(l, 1)).toBe(l.field.y);
  });
});
