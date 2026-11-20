import { describe, expect, it } from 'vitest';
import { rectsOverlap } from './layout';
import { MALL_COLUMNS, mallLayout } from './mallLayout';

describe('商城畫面排版', () => {
  const W = 844;
  const H = 390;
  const TOP = 56;
  const l = mallLayout(W, H, TOP);

  it('六張卡三欄兩列，都在畫面內、不重疊', () => {
    expect(l.cards).toHaveLength(6);
    expect(l.cards[MALL_COLUMNS - 1].card.y).toBe(l.cards[0].card.y);
    expect(l.cards[MALL_COLUMNS].card.y).toBeGreaterThan(l.cards[0].card.y);
    for (const c of l.cards) {
      expect(c.card.y).toBeGreaterThan(l.note.y + 16);
      expect(c.card.x).toBeGreaterThanOrEqual(0);
      expect(c.card.x + c.card.width).toBeLessThanOrEqual(W);
      expect(c.card.y + c.card.height).toBeLessThanOrEqual(H);
    }
    for (let i = 0; i < l.cards.length; i++)
      for (let j = i + 1; j < l.cards.length; j++)
        expect(rectsOverlap(l.cards[i].card, l.cards[j].card)).toBe(false);
  });

  it('每張卡：圖示、文字、按鈕都在卡片裡，按鈕夠大、不蓋到圖示', () => {
    for (const c of l.cards) {
      for (const r of [c.icon, c.buy]) {
        expect(r.x).toBeGreaterThanOrEqual(c.card.x);
        expect(r.y).toBeGreaterThanOrEqual(c.card.y);
        expect(r.x + r.width).toBeLessThanOrEqual(c.card.x + c.card.width);
        expect(r.y + r.height).toBeLessThanOrEqual(c.card.y + c.card.height);
      }
      expect(c.buy.height).toBeGreaterThanOrEqual(44);
      expect(c.buy.y).toBeGreaterThanOrEqual(c.icon.y + c.icon.height);
      expect(c.text.x).toBeGreaterThan(c.icon.x + c.icon.width);
      expect(c.text.x + c.text.width).toBeLessThanOrEqual(c.card.x + c.card.width);
      expect(c.text.width).toBeGreaterThan(120);
    }
  });
});
