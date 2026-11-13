import { describe, expect, it } from 'vitest';
import { battleLayout, slotBounds } from './battleLayout';
import { rectInside, rectsOverlap, type Rect } from './layout';

const VIEWS = [
  { name: '直式', w: 390, h: 844, landscape: false },
  { name: '橫式', w: 844, h: 390, landscape: true },
];

/** 幾種三排陣型：全前排、照定位分三排、後排三隻、Boss 單獨站中排 */
const TEAM_ROWS: number[][] = [
  [0],
  [0, 2],
  [1, 0, 0],
  [0, 0, 0],
  [1, 0, 0, 2],
  [1, 0, 0, 2, 2],
  [2, 2, 2, 0, 0],
  [0, 0, 0, 1, 1],
  [0, 1, 1, 1, 2],
];
const ENEMY_ROWS: number[][] = [[1], [0, 0, 1], [0, 0, 0], [0, 1, 2]];

describe('battleLayout', () => {
  for (const v of VIEWS) {
    it(`${v.name}：各種陣型都在畫面內、互不重疊、不擋到按鈕`, () => {
      const screen: Rect = { x: 0, y: 0, width: v.w, height: v.h };
      for (const team of TEAM_ROWS) {
        for (const enemies of ENEMY_ROWS) {
          const l = battleLayout(v.w, v.h, v.landscape, team, enemies);
          expect(l.team).toHaveLength(team.length);
          expect(l.enemies).toHaveLength(enemies.length);
          for (const r of [l.speed, l.skip, l.auto]) expect(rectInside(r, screen)).toBe(true);
          expect(rectsOverlap(l.speed, l.skip)).toBe(false);
          expect(rectsOverlap(l.auto, l.skip)).toBe(false);
          expect(rectsOverlap(l.auto, l.speed)).toBe(false);
          const boxes = [...l.team, ...l.enemies].map(slotBounds);
          boxes.forEach((b, i) => {
            const label = `${team.join('')} 對 ${enemies.join('')} 第 ${i + 1} 格`;
            expect(rectInside(b, screen), label).toBe(true);
            expect(b.y, label).toBeGreaterThanOrEqual(l.barHeight);
            expect(rectsOverlap(b, l.skip), label).toBe(false);
            expect(rectsOverlap(b, l.auto), label).toBe(false);
            for (let j = 0; j < i; j++) expect(rectsOverlap(b, boxes[j]), label).toBe(false);
          });
          // 我方在左、敵方在右
          const mid = v.w / 2;
          for (const s of l.team) expect(s.x).toBeLessThan(mid);
          for (const s of l.enemies) expect(s.x).toBeGreaterThan(mid);
          // 前排最靠近中線，中排、後排依序往外
          if (team.length > 1) team.forEach((row, i) => expect(l.team[i].x).toBe(l.rowX.team[row]));
          if (enemies.length > 1) {
            enemies.forEach((row, i) => expect(l.enemies[i].x).toBe(l.rowX.enemy[row]));
          }
          expect(l.rowX.team[0]).toBeGreaterThan(l.rowX.team[1]);
          expect(l.rowX.team[1]).toBeGreaterThan(l.rowX.team[2]);
          expect(l.rowX.enemy[0]).toBeLessThan(l.rowX.enemy[1]);
          expect(l.rowX.enemy[1]).toBeLessThan(l.rowX.enemy[2]);
        }
      }
    });
  }

  it('只有一隻敵人（Boss）時畫得比較大', () => {
    const boss = battleLayout(390, 844, false, [0, 0, 1], [1]).enemies[0];
    const mob = battleLayout(390, 844, false, [0, 0, 1], [0, 0, 1]).enemies[0];
    expect(boss.r).toBeGreaterThan(mob.r);
  });
});
