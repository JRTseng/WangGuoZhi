import { describe, expect, it } from 'vitest';
import { QUEST_COLUMNS, QUEST_ROWS, questLayout } from './questLayout';

describe('任務畫面排版', () => {
  const W = 844;
  const H = 390;
  const l = questLayout(W, H);

  it('兩欄五列共 10 張卡片，全部在畫面內、彼此不重疊', () => {
    expect(l.cards).toHaveLength(QUEST_COLUMNS * QUEST_ROWS);
    for (const c of l.cards) {
      expect(c.x).toBeGreaterThan(l.tabs[0].x + l.tabs[0].width);
      expect(c.x + c.width).toBeLessThanOrEqual(W);
      expect(c.y).toBeGreaterThanOrEqual(56);
      expect(c.y + c.height).toBeLessThanOrEqual(H);
    }
    expect(l.cards[1].x).toBeGreaterThanOrEqual(l.cards[0].x + l.cards[0].width);
    expect(l.cards[2].y).toBeGreaterThanOrEqual(l.cards[0].y + l.cards[0].height);
  });

  it('分頁、全部領取與卡片上的按鈕都夠大，好按', () => {
    for (const r of [...l.tabs, l.claimAll]) {
      expect(r.height).toBeGreaterThanOrEqual(40);
      expect(r.y + r.height).toBeLessThanOrEqual(H);
    }
    expect(l.claimAll.y).toBeGreaterThanOrEqual(l.tabs[2].y + l.tabs[2].height);
    expect(l.button.height).toBeGreaterThanOrEqual(40);
    expect(l.button.x + l.button.width).toBeLessThanOrEqual(l.cards[0].width);
    expect(l.button.y + l.button.height).toBeLessThanOrEqual(l.cards[0].height);
  });
});
