import { describe, expect, it } from 'vitest';
import { BOARDING_MAX_SLOTS } from './boarding';
import { boardingButton, boardingLayout, boardingRow } from './boardingLayout';
import { rectInside, rectsOverlap } from './layout';

const VIEWS = [
  [390, 844, false],
  [844, 390, true],
] as const;

describe('boardingLayout', () => {
  it('寄宿位都在畫面內、不重疊，名單在寄宿位下面', () => {
    for (const [w, h, landscape] of VIEWS) {
      const l = boardingLayout(w, h, landscape, 6);
      expect(l.slots).toHaveLength(BOARDING_MAX_SLOTS);
      const screen = { x: 0, y: 56, width: w, height: h - 56 };
      l.slots.forEach((s, i) => {
        expect(rectInside(s, screen)).toBe(true);
        for (const other of l.slots.slice(i + 1)) expect(rectsOverlap(s, other)).toBe(false);
        expect(s.y + s.height).toBeLessThanOrEqual(l.listTitle.y);
      });
      expect(l.listTitle.y).toBeLessThan(l.list.y);
      expect(rectInside(l.list, screen)).toBe(true);
      // 名單至少看得到兩列
      expect(l.list.height).toBeGreaterThanOrEqual(l.rowHeight * 2 + l.gap);
    }
  });

  it('直式寄宿位一列一個、名單一欄；橫式寄宿位並排、名單兩欄', () => {
    const p = boardingLayout(390, 844, false, 4);
    expect(p.slots[1].x).toBe(p.slots[0].x);
    expect(p.slots[1].y).toBeGreaterThan(p.slots[0].y);
    expect(p.columns).toBe(1);
    const l = boardingLayout(844, 390, true, 4);
    expect(l.slots[1].y).toBe(l.slots[0].y);
    expect(l.slots[1].x).toBeGreaterThan(l.slots[0].x);
    expect(l.columns).toBe(2);
    expect(boardingRow(l, 1).y).toBe(boardingRow(l, 0).y);
    expect(boardingRow(l, 2).y).toBeGreaterThan(boardingRow(l, 0).y);
  });

  it('按鈕在卡片裡面，直式至少 40 高、好按', () => {
    for (const [w, h, landscape] of VIEWS) {
      const l = boardingLayout(w, h, landscape, 6);
      for (const card of [...l.slots, boardingRow(l, 0), boardingRow(l, 5)]) {
        const b = boardingButton(l, card);
        expect(rectInside(b, card)).toBe(true);
        expect(b.height).toBeGreaterThanOrEqual(40);
        expect(b.width).toBeGreaterThanOrEqual(64);
        // 左邊留得下頭像與文字
        expect(b.x - card.x).toBeGreaterThanOrEqual(170);
      }
    }
  });

  it('狗多了可以捲動，捲到底剛好看到最後一列；沒有狗也不會出錯', () => {
    const l = boardingLayout(390, 844, false, 30);
    expect(l.scrollMax).toBeGreaterThan(0);
    const last = boardingRow(l, 29);
    expect(last.y + last.height - l.scrollMax).toBeCloseTo(l.list.y + l.list.height);
    const none = boardingLayout(390, 844, false, 0);
    expect(none.contentHeight).toBe(0);
    expect(none.scrollMax).toBe(0);
  });
});
