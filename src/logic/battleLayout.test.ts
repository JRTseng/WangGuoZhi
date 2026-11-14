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

  it('頭目旁邊有小兵（T018）：頭目畫大一點，還是站在自己那一排，不會疊到同伴', () => {
    // 前排兩隻小兵、中排頭目、後排一隻
    const rows = [0, 0, 1, 2];
    const big = [false, false, true, false];
    for (const landscape of [true, false]) {
      const [w, h] = landscape ? [844, 390] : [390, 844];
      const l = battleLayout(w, h, landscape, [0, 0, 1], rows, undefined, big);
      // 橫式（遊戲固定橫向）會放大；直式跑道太窄就維持一樣大
      if (landscape) expect(l.enemies[2].r).toBeGreaterThan(l.enemies[0].r);
      else expect(l.enemies[2].r).toBeGreaterThanOrEqual(l.enemies[0].r);
      expect(l.enemies[2].x).toBe(l.rowX.enemy[1]);
      const boxes = l.enemies.map(slotBounds);
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          const apart =
            a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y;
          expect(apart, `${landscape}:${i}-${j}`).toBe(true);
        }
      }
    }
    // 一排站滿三隻時跑道不夠高，頭目就不放大
    const tight = battleLayout(844, 390, true, [0], [0, 0, 0, 1, 1, 1], undefined, [
      false,
      false,
      false,
      true,
      false,
      false,
    ]);
    expect(tight.enemies[3].r).toBeLessThanOrEqual(tight.enemies[0].r * 1.35);
  });

  it('九宮格：橫式照格子站成 3×3（上中下三條橫線對齊）；直式由上而下的順序和陣型面板一樣', () => {
    // 大耳中排中、黑旋前排上、長鬚前排下、小算後排上、阿白後排下
    const rows = [1, 0, 0, 2, 2];
    const lanes = [1, 0, 2, 0, 2];
    const land = battleLayout(844, 390, true, rows, [0, 0, 1], lanes);
    const ys = [0, 1, 2].map((lane) => [
      ...new Set(land.team.filter((_, i) => lanes[i] === lane).map((s) => s.y)),
    ]);
    for (const y of ys) expect(y).toHaveLength(1);
    expect(ys[0][0]).toBeLessThan(ys[1][0]);
    expect(ys[1][0]).toBeLessThan(ys[2][0]);
    rows.forEach((row, i) => expect(land.team[i].x).toBe(land.rowX.team[row]));
    // 只有兩隻也站在自己的格子上，不會被拉到中間
    const two = battleLayout(844, 390, true, [0, 0], [0, 0, 1], [0, 1]);
    expect(two.team[0].y).toBe(ys[0][0]);
    expect(two.team[1].y).toBe(ys[1][0]);

    const port = battleLayout(390, 844, false, rows, [0, 0, 1], lanes);
    // 由上而下：上面那一列（黑旋、小算）→ 中（大耳）→ 下（長鬚、阿白）
    const order = [1, 3, 0, 2, 4];
    for (let n = 1; n < order.length; n++) {
      expect(port.team[order[n]].y).toBeGreaterThan(port.team[order[n - 1]].y);
    }
    for (const v of VIEWS) {
      for (const [r, ls] of [
        [rows, lanes],
        [
          [0, 0, 0, 1, 1],
          [0, 1, 2, 0, 2],
        ],
        [
          [0, 1, 2],
          [1, 1, 1],
        ],
        [
          [2, 2, 2, 1, 0],
          [0, 1, 2, 1, 1],
        ],
      ] as [number[], number[]][]) {
        const l = battleLayout(v.w, v.h, v.landscape, r, [0, 0, 1], ls);
        const boxes = [...l.team, ...l.enemies].map(slotBounds);
        boxes.forEach((b, i) => {
          expect(rectInside(b, { x: 0, y: 0, width: v.w, height: v.h })).toBe(true);
          expect(rectsOverlap(b, l.skip)).toBe(false);
          for (let j = 0; j < i; j++)
            expect(rectsOverlap(b, boxes[j]), `${v.name} ${r} ${i}`).toBe(false);
        });
      }
    }
  });

  it('只有一隻敵人（Boss）時畫得比較大', () => {
    const boss = battleLayout(390, 844, false, [0, 0, 1], [1]).enemies[0];
    const mob = battleLayout(390, 844, false, [0, 0, 1], [0, 0, 1]).enemies[0];
    expect(boss.r).toBeGreaterThan(mob.r);
  });
});
