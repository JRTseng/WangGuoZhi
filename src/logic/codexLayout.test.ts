import { describe, expect, it } from 'vitest';
import {
  CODEX_BACKGROUND_COLUMNS,
  CODEX_COLUMNS,
  codexColumnsFor,
  codexLayout,
} from './codexLayout';
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

  it('四顆分頁排成兩列，都點得到、不重疊，下面的進度與獎勵還是放得下（T043）', () => {
    for (const milestones of [4, 5]) {
      const l4 = codexLayout(W, H, TOP, 50, 4, milestones);
      expect(l4.tabs).toHaveLength(4);
      expect(l4.tabs[2].y).toBeGreaterThan(l4.tabs[0].y);
      expect(l4.tabs[1].y).toBe(l4.tabs[0].y);
      for (let i = 0; i < 4; i++) {
        expect(l4.tabs[i].width).toBeGreaterThanOrEqual(44);
        expect(l4.tabs[i].height).toBeGreaterThanOrEqual(44);
        expect(l4.tabs[i].x + l4.tabs[i].width).toBeLessThan(l4.cells[0].x);
        for (let j = i + 1; j < 4; j++) expect(rectsOverlap(l4.tabs[i], l4.tabs[j])).toBe(false);
      }
      expect(l4.count.y).toBeGreaterThanOrEqual(l4.tabs[3].y + l4.tabs[3].height);
      expect(l4.milestones).toHaveLength(milestones);
      expect(l4.milestones[0].y).toBeGreaterThan(l4.rarity.y + 28);
      l4.milestones.forEach((m, i) => {
        if (i > 0) expect(m.y - l4.milestones[i - 1].y).toBeGreaterThanOrEqual(16);
      });
      expect(l4.milestones[milestones - 1].y + 16).toBeLessThanOrEqual(l4.claim.y);
    }
  });

  it('66 種裝備自動排成十一欄六列，每格還是點得到（T043）', () => {
    expect(codexColumnsFor(50, H, TOP)).toBe(CODEX_COLUMNS);
    const columns = codexColumnsFor(66, H, TOP);
    expect(columns).toBe(11);
    const lg = codexLayout(W, H, TOP, 66, 4, 5, columns);
    expect(lg.cells).toHaveLength(66);
    for (const c of lg.cells) {
      expect(c.x + c.width).toBeLessThanOrEqual(W);
      expect(c.y + c.height).toBeLessThanOrEqual(H);
      expect(c.width).toBeGreaterThanOrEqual(44);
      expect(c.height).toBeGreaterThanOrEqual(44);
    }
    expect(lg.cells[columns].y).toBeGreaterThan(lg.cells[0].y);
    expect(rectsOverlap(lg.cells[0], lg.cells[1])).toBe(false);
  });

  it('12 張背景排成四欄三列，縮圖夠大（T043）', () => {
    const lb = codexLayout(W, H, TOP, 12, 4, 4, CODEX_BACKGROUND_COLUMNS);
    expect(lb.cells).toHaveLength(12);
    expect(lb.cells[4].y).toBeGreaterThan(lb.cells[3].y);
    for (const c of lb.cells) {
      expect(c.width).toBeGreaterThanOrEqual(120);
      expect(c.height).toBeGreaterThanOrEqual(80);
      expect(c.x + c.width).toBeLessThanOrEqual(W);
      expect(c.y + c.height).toBeLessThanOrEqual(H);
    }
  });
});
