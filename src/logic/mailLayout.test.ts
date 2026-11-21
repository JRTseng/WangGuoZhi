import { describe, expect, it } from 'vitest';
import { rectsOverlap } from './layout';
import { MAIL_ROWS, mailLayout, mailPages } from './mailLayout';

describe('信箱畫面排版', () => {
  const W = 844;
  const H = 390;
  const TOP = 56;
  const l = mailLayout(W, H, TOP);
  const buttons = [l.prev, l.next, l.claim, l.remove, l.claimAll, l.clean];

  it('清單一頁五列，都在畫面內、不重疊、手指點得到', () => {
    expect(l.rows).toHaveLength(MAIL_ROWS);
    l.rows.forEach((r, i) => {
      expect(r.y).toBeGreaterThanOrEqual(TOP);
      expect(r.height).toBeGreaterThanOrEqual(44);
      expect(r.y + r.height).toBeLessThanOrEqual(l.prev.y);
      if (i > 0) expect(r.y).toBeGreaterThan(l.rows[i - 1].y + l.rows[i - 1].height);
      expect(rectsOverlap(r, l.pane)).toBe(false);
    });
  });

  it('六顆按鈕都在畫面內、至少 44 高、互不重疊', () => {
    for (const b of buttons) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(W);
      expect(b.y + b.height).toBeLessThanOrEqual(H);
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.width).toBeGreaterThanOrEqual(44);
    }
    for (let i = 0; i < buttons.length; i++) {
      for (let j = i + 1; j < buttons.length; j++) {
        expect(rectsOverlap(buttons[i], buttons[j])).toBe(false);
      }
    }
  });

  it('信的按鈕與附件都在右邊那個框裡，附件在按鈕上面、文字在附件上面', () => {
    for (const b of [l.claim, l.remove, l.claimAll, l.clean, l.gifts]) {
      expect(b.x).toBeGreaterThanOrEqual(l.pane.x);
      expect(b.x + b.width).toBeLessThanOrEqual(l.pane.x + l.pane.width);
      expect(b.y + b.height).toBeLessThanOrEqual(l.pane.y + l.pane.height);
    }
    expect(l.gifts.y + l.gifts.height).toBeLessThanOrEqual(l.claim.y);
    expect(l.text.y).toBeLessThan(l.gifts.y - 80);
    expect(l.text.x + l.text.width).toBeLessThanOrEqual(l.pane.x + l.pane.width);
    expect(l.claim.x + l.claim.width).toBeLessThan(l.remove.x);
    expect(l.remove.x + l.remove.width).toBeLessThan(l.claimAll.x);
  });

  it('頁數：五封一頁，沒有信也算一頁', () => {
    expect(mailPages(0)).toBe(1);
    expect(mailPages(5)).toBe(1);
    expect(mailPages(6)).toBe(2);
    expect(mailPages(19)).toBe(4);
  });
});
