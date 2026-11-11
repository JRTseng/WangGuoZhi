import { describe, expect, it } from 'vitest';
import { battleLayout, slotBounds } from './battleLayout';
import { rectInside, rectsOverlap, type Rect } from './layout';

const VIEWS = [
  { name: '直式', w: 390, h: 844, landscape: false },
  { name: '橫式', w: 844, h: 390, landscape: true },
];

describe('battleLayout', () => {
  for (const v of VIEWS) {
    it(`${v.name}：1 到 5 隻對 1 或 3 隻敵人，全部在畫面內、互不重疊、不擋到按鈕`, () => {
      const screen: Rect = { x: 0, y: 0, width: v.w, height: v.h };
      for (let team = 1; team <= 5; team++) {
        for (const enemies of [1, 3]) {
          const l = battleLayout(v.w, v.h, v.landscape, team, enemies);
          expect(l.team).toHaveLength(team);
          expect(l.enemies).toHaveLength(enemies);
          expect(rectInside(l.speed, screen)).toBe(true);
          expect(rectInside(l.skip, screen)).toBe(true);
          expect(rectsOverlap(l.speed, l.skip)).toBe(false);
          const boxes = [...l.team, ...l.enemies].map(slotBounds);
          boxes.forEach((b, i) => {
            const label = `${team} 對 ${enemies} 第 ${i + 1} 格`;
            expect(rectInside(b, screen), label).toBe(true);
            expect(b.y, label).toBeGreaterThanOrEqual(l.barHeight);
            expect(rectsOverlap(b, l.skip), label).toBe(false);
            for (let j = 0; j < i; j++) expect(rectsOverlap(b, boxes[j]), label).toBe(false);
          });
          // 我方在左、敵方在右
          const mid = v.w / 2;
          for (const s of l.team) expect(s.x).toBeLessThan(mid);
          for (const s of l.enemies) expect(s.x).toBeGreaterThan(mid);
        }
      }
    });
  }

  it('只有一隻敵人（Boss）時畫得比較大', () => {
    const boss = battleLayout(390, 844, false, 3, 1).enemies[0];
    const mob = battleLayout(390, 844, false, 3, 3).enemies[0];
    expect(boss.r).toBeGreaterThan(mob.r);
  });
});
