import { describe, expect, it } from 'vitest';
import { codexLayout, CODEX_COLUMNS } from './codexLayout';
import { rectsOverlap } from './layout';

describe('圖鑑畫面排版', () => {
  const W = 844;
  const H = 390;
  const TOP = 56;
  const l = codexLayout(W, H, TOP, 50);

  it('50 格一頁放得下：十欄五列，都在畫面內、不重疊、手指點得到', () => {
    expect(l.cells).toHaveLength(50);
    expect(l.cells[CODEX_COLUMNS].y).toBeGreaterThan(l.cells[0].y);
    expect(l.cells[CODEX_COLUMNS - 1].y).toBe(l.cells[0].y);
    for (const c of l.cells) {
      expect(c.y).toBeGreaterThanOrEqual(TOP);
      expect(c.x + c.width).toBeLessThanOrEqual(W);
      expect(c.y + c.height).toBeLessThanOrEqual(H);
      expect(c.width).toBeGreaterThanOrEqual(44);
      expect(c.height).toBeGreaterThanOrEqual(44);
    }
    for (let i = 0; i < l.cells.length; i++)
      for (let j = i + 1; j < l.cells.length; j++)
        expect(rectsOverlap(l.cells[i], l.cells[j])).toBe(false);
  });

  it('左邊一欄：分頁、進度、獎勵、領取由上到下，不會蓋到格子', () => {
    expect(l.tabs).toHaveLength(2);
    expect(rectsOverlap(l.tabs[0], l.tabs[1])).toBe(false);
    for (const t of l.tabs) {
      expect(t.width).toBeGreaterThanOrEqual(44);
      expect(t.height).toBeGreaterThanOrEqual(44);
      expect(t.x + t.width).toBeLessThan(l.cells[0].x);
    }
    expect(l.count.y).toBeGreaterThanOrEqual(l.tabs[0].y + l.tabs[0].height);
    expect(l.rarity.y).toBeGreaterThan(l.count.y);
    expect(l.milestones).toHaveLength(5);
    expect(l.milestones[0].y).toBeGreaterThan(l.rarity.y + 28);
    l.milestones.forEach((m, i) => {
      if (i > 0) expect(m.y - l.milestones[i - 1].y).toBeGreaterThanOrEqual(16);
    });
    expect(l.milestones[4].y + 16).toBeLessThanOrEqual(l.claim.y);
    expect(l.claim.height).toBeGreaterThanOrEqual(44);
    expect(l.claim.y + l.claim.height).toBeLessThanOrEqual(H);
    expect(l.claim.x + l.claim.width).toBeLessThan(l.cells[0].x);
  });
});
