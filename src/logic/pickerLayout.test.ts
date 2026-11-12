import { describe, expect, it } from 'vitest';
import { rectInside, rectsOverlap, type Rect } from './layout';
import { clampScroll, gridCell, gridContentHeight, layoutPicker, maxScroll } from './pickerLayout';

const cases = [
  { name: '直式・組隊', w: 390, h: 844, landscape: false, top: 62, bottom: 828 },
  { name: '直式・出征', w: 390, h: 844, landscape: false, top: 96, bottom: 706 },
  { name: '橫式・組隊', w: 844, h: 390, landscape: true, top: 62, bottom: 378 },
  { name: '橫式・出征', w: 844, h: 390, landscape: true, top: 62, bottom: 378, slotsBottom: 276 },
];

describe('選狗畫面排版', () => {
  for (const c of cases) {
    it(`${c.name}：全部在畫面內、互不重疊`, () => {
      const l = layoutPicker({ ...c, roleCount: 6, statusCount: 3 });
      const screen: Rect = { x: 0, y: 0, width: c.w, height: c.h };
      const all = [l.autoButton, ...l.slots, ...l.roleChips, ...l.statusChips, l.sortChip, l.grid];
      expect(l.slots).toHaveLength(5);
      for (const r of all) {
        expect(rectInside(r, screen)).toBe(true);
        expect(r.width).toBeGreaterThan(0);
        expect(r.height).toBeGreaterThan(0);
      }
      for (let i = 0; i < all.length; i++)
        for (let j = i + 1; j < all.length; j++) expect(rectsOverlap(all[i], all[j])).toBe(false);
      // 手指好點：按鈕至少 36 高、卡片格至少放得下一整排
      for (const r of [...l.roleChips, ...l.statusChips, l.sortChip, l.autoButton])
        expect(r.height).toBeGreaterThanOrEqual(36);
      expect(l.grid.height).toBeGreaterThanOrEqual(l.cellHeight);
      const lastCol = gridCell(l.columns - 1, l);
      expect(lastCol.x + lastCol.width).toBeLessThanOrEqual(l.grid.x + l.grid.width);
    });
  }

  it('卡片由左到右、由上到下', () => {
    const l = layoutPicker({ ...cases[0], roleCount: 6, statusCount: 3 });
    expect(gridCell(0, l)).toMatchObject({ x: l.grid.x, y: l.grid.y });
    expect(gridCell(3, l)).toMatchObject({ x: l.grid.x, y: l.grid.y + l.cellHeight + l.gap });
    expect(gridCell(1, l).x).toBeGreaterThan(gridCell(0, l).x);
  });

  it('捲動範圍：放得下不能捲，放不下捲到最後一排剛好貼底', () => {
    expect(gridContentHeight(0, 3, 150, 8)).toBe(0);
    expect(gridContentHeight(8, 3, 150, 8)).toBe(466);
    expect(maxScroll(466, 500)).toBe(0);
    expect(maxScroll(940, 500)).toBe(440);
    expect(clampScroll(-20, 440)).toBe(0);
    expect(clampScroll(999, 440)).toBe(440);
    expect(clampScroll(100, 440)).toBe(100);
  });
});
