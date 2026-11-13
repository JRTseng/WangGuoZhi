import { describe, expect, it } from 'vitest';
import { formationLayout, formationPanelSize } from './formationLayout';
import { rectInside, rectsOverlap, type Rect } from './layout';

const VIEWS = [
  { name: '直式', w: 390, h: 844 },
  { name: '橫式', w: 844, h: 390 },
];

describe('formationLayout', () => {
  for (const v of VIEWS) {
    it(`${v.name}：三排、每排三格與兩顆按鈕都在卡片內、互不重疊`, () => {
      const size = formationPanelSize(v.w, v.h);
      const box: Rect = {
        x: (v.w - size.width) / 2,
        y: (v.h - size.height) / 2,
        width: size.width,
        height: size.height,
      };
      expect(rectInside(box, { x: 0, y: 0, width: v.w, height: v.h })).toBe(true);
      const l = formationLayout(box);
      expect(l.rows).toHaveLength(3);
      const all = [...l.rows, l.reset, l.close];
      all.forEach((r, i) => {
        expect(rectInside(r, box)).toBe(true);
        for (let j = 0; j < i; j++) expect(rectsOverlap(r, all[j])).toBe(false);
      });
      l.slots.forEach((list, row) => {
        expect(list).toHaveLength(3);
        list.forEach((s, i) => {
          expect(rectInside(s, l.rows[row])).toBe(true);
          expect(s.height).toBeGreaterThanOrEqual(40);
          if (i > 0) expect(rectsOverlap(s, list[i - 1])).toBe(false);
        });
      });
      // 前排在最右邊（面對敵人），後排在最左邊
      expect(l.rows[0].x).toBeGreaterThan(l.rows[1].x);
      expect(l.rows[1].x).toBeGreaterThan(l.rows[2].x);
    });
  }
});
