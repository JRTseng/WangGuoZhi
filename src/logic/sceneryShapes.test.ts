import { describe, expect, it } from 'vitest';
import {
  mixColor,
  ridge,
  ridgePolygon,
  sag,
  scatter,
  seeded,
  type RidgeStyle,
} from './sceneryShapes';

describe('mixColor', () => {
  it('頭尾就是原本的顏色，中間各取一半', () => {
    expect(mixColor(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixColor(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mixColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(mixColor(0xff0000, 0x0000ff, 0.5)).toBe(0x800080);
  });

  it('比例超出範圍就當成 0 或 1', () => {
    expect(mixColor(0x102030, 0xa0b0c0, -1)).toBe(0x102030);
    expect(mixColor(0x102030, 0xa0b0c0, 2)).toBe(0xa0b0c0);
  });
});

describe('seeded', () => {
  it('同一個種子每次都一樣，不同種子不一樣', () => {
    const a = seeded(7);
    const b = seeded(7);
    const c = seeded(8);
    const seqA = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(seqA);
    expect([c(), c(), c()]).not.toEqual(seqA);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('ridge', () => {
  const styles: RidgeStyle[] = ['hills', 'peaks', 'dunes', 'mesa'];
  for (const style of styles) {
    it(`${style}：從左到右、不低於山腳、不高過上限`, () => {
      const line = ridge({ seed: 3, width: 844, base: 200, height: 80, style });
      expect(line[0].x).toBe(0);
      expect(line[line.length - 1].x).toBe(844);
      line.forEach((p, i) => {
        expect(p.y).toBeLessThanOrEqual(200);
        expect(p.y).toBeGreaterThanOrEqual(120);
        if (i > 0) expect(p.x).toBeGreaterThan(line[i - 1].x);
      });
      // 真的有起伏
      const ys = line.map((p) => p.y);
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(20);
    });
  }

  it('同一個種子畫出同一座山', () => {
    const o = { seed: 11, width: 400, base: 100, height: 50, style: 'peaks' as const };
    expect(ridge(o)).toEqual(ridge(o));
    expect(ridge({ ...o, seed: 12 })).not.toEqual(ridge(o));
  });

  it('ridgePolygon 把底部補起來', () => {
    const line = ridge({ seed: 1, width: 100, base: 50, height: 20, style: 'hills', step: 50 });
    const poly = ridgePolygon(line, 90);
    expect(poly.length).toBe(line.length + 2);
    expect(poly[poly.length - 1]).toEqual({ x: 0, y: 90 });
    expect(poly[poly.length - 2]).toEqual({ x: 100, y: 90 });
    expect(ridgePolygon([], 90)).toEqual([]);
  });
});

describe('scatter', () => {
  const area = { x: 10, y: 100, width: 300, height: 80 };

  it('點都在區域裡，由上到下排好，越下面越大', () => {
    const pts = scatter(5, 40, area);
    expect(pts.length).toBe(40);
    pts.forEach((p, i) => {
      expect(p.x).toBeGreaterThanOrEqual(10);
      expect(p.x).toBeLessThanOrEqual(310);
      expect(p.y).toBeGreaterThanOrEqual(100);
      expect(p.y).toBeLessThanOrEqual(180);
      if (i > 0) {
        expect(p.y).toBeGreaterThanOrEqual(pts[i - 1].y);
        expect(p.s).toBeGreaterThanOrEqual(pts[i - 1].s);
      }
    });
  });

  it('同一個種子撒出同一批點', () => {
    expect(scatter(5, 10, area)).toEqual(scatter(5, 10, area));
  });
});

describe('sag', () => {
  it('兩端固定，中間垂最低', () => {
    const pts = sag({ x: 0, y: 10 }, { x: 100, y: 10 }, 20, 4);
    expect(pts.length).toBe(5);
    expect(pts[0]).toEqual({ x: 0, y: 10 });
    expect(pts[4]).toEqual({ x: 100, y: 10 });
    expect(pts[2]).toEqual({ x: 50, y: 30 });
  });
});
