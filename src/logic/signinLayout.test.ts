import { describe, expect, it } from 'vitest';
import { signinLayout, signinPickLayout } from './signinLayout';

describe('簽到畫面排版', () => {
  const W = 844;
  const H = 390;
  const l = signinLayout(W, H);

  it('七張卡片排成一列，全部在畫面內、彼此不重疊、左右對稱', () => {
    expect(l.cards).toHaveLength(7);
    l.cards.forEach((c, i) => {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x + c.width).toBeLessThanOrEqual(W);
      expect(c.y).toBeGreaterThan(l.hint.y);
      expect(c.y + c.height).toBeLessThanOrEqual(l.claim.y);
      expect(c.width).toBeGreaterThanOrEqual(100);
      expect(c.height).toBeGreaterThanOrEqual(150);
      if (i > 0) expect(c.x).toBeGreaterThanOrEqual(l.cards[i - 1].x + l.cards[i - 1].width);
    });
    const last = l.cards[6];
    expect(W - (last.x + last.width)).toBeLessThanOrEqual(l.cards[0].x + 1);
  });

  it('「簽到領取」夠大、在畫面中間、沒有超出畫面', () => {
    expect(l.claim.height).toBeGreaterThanOrEqual(44);
    expect(l.claim.x + l.claim.width / 2).toBeCloseTo(W / 2, 0);
    expect(l.claim.y + l.claim.height).toBeLessThanOrEqual(H);
    expect(l.total.x).toBeLessThan(l.claim.x);
    expect(l.countdown.x).toBeGreaterThan(l.claim.x + l.claim.width);
  });
});

describe('選 SSR 狗的彈出框排版', () => {
  const W = 844;
  const H = 390;

  it.each([1, 7, 10, 14, 21])('%i 隻狗：都在框內、不重疊、夠大好按', (n) => {
    const p = signinPickLayout(W, H, n);
    expect(p.cells).toHaveLength(n);
    expect(p.size.width).toBeLessThanOrEqual(W - 32);
    expect(p.size.height).toBeLessThanOrEqual(H - 24);
    p.cells.forEach((c, i) => {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x + c.width).toBeLessThanOrEqual(p.size.width);
      expect(c.y).toBeGreaterThanOrEqual(p.title.y);
      expect(c.y + c.height).toBeLessThanOrEqual(p.size.height);
      expect(c.width).toBeGreaterThanOrEqual(44);
      expect(c.height).toBeGreaterThanOrEqual(44);
      for (const o of p.cells.slice(0, i)) {
        const apart =
          c.x >= o.x + o.width ||
          o.x >= c.x + c.width ||
          c.y >= o.y + o.height ||
          o.y >= c.y + c.height;
        expect(apart).toBe(true);
      }
    });
    expect(p.close.width).toBeGreaterThanOrEqual(44);
  });
});
