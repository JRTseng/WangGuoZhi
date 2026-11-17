import { describe, expect, it } from 'vitest';
import { hasFurnitureArt } from '../scenes/components/furnitureArt';
import { createInitialState } from '../state/gameState';
import {
  FURNITURE,
  HOME_MAX,
  HOME_STYLES,
  clearFurniture,
  findHomeStyle,
  furnitureOf,
  homePlaced,
  homeResidents,
  moveFurniture,
  sanitizeHome,
  setHomeArea,
  setHomeStyle,
  starterFurniture,
  toggleFurniture,
  toggleResident,
} from './home';
import { homeLayout, homeModalGrid, spotOf, xyOf } from './homeLayout';

const base = () => createInitialState(0);

describe('家具與風格的資料', () => {
  it('家具 50 種：屋內 25、庭院 25，id 與名字不重複，每一件都有圖', () => {
    expect(FURNITURE).toHaveLength(50);
    expect(furnitureOf('indoor')).toHaveLength(25);
    expect(furnitureOf('yard')).toHaveLength(25);
    expect(new Set(FURNITURE.map((f) => f.id)).size).toBe(50);
    expect(new Set(FURNITURE.map((f) => f.name)).size).toBe(50);
    for (const f of FURNITURE) {
      expect(hasFurnitureArt(f.id), f.id).toBe(true);
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.x).toBeLessThanOrEqual(1);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeLessThanOrEqual(1);
      expect(f.note.length).toBeGreaterThan(0);
    }
  });

  it('Jimmy 點名的都有：貓跳台在屋內，泳池、飛盤、球球在庭院', () => {
    const at = (id: string) => FURNITURE.find((f) => f.id === id)?.area;
    expect(at('cattree')).toBe('indoor');
    expect(at('pool')).toBe('yard');
    expect(at('frisbee')).toBe('yard');
    expect(at('ball')).toBe('yard');
  });

  it('風格 15 種，id 與名字不重複；不認得的 id 當成第一種', () => {
    expect(HOME_STYLES).toHaveLength(15);
    expect(new Set(HOME_STYLES.map((s) => s.id)).size).toBe(15);
    expect(new Set(HOME_STYLES.map((s) => s.name)).size).toBe(15);
    expect(findHomeStyle('nope')).toBe(HOME_STYLES[0]);
  });

  it('一開始擺的家具兩國不同：喵國有貓跳台，汪國有泳池；兩個場景都不會空著也不會太擠', () => {
    const dog = Object.keys(starterFurniture('dog'));
    const cat = Object.keys(starterFurniture('cat'));
    expect(cat).toContain('cattree');
    expect(dog).not.toContain('cattree');
    expect(dog).toContain('pool');
    expect(cat).not.toContain('pool');
    for (const f of ['dog', 'cat'] as const) {
      for (const area of ['indoor', 'yard'] as const) {
        const n = homePlaced(base(), f, area).length;
        expect(n).toBeGreaterThanOrEqual(4);
        expect(n).toBeLessThanOrEqual(10);
      }
    }
  });
});

describe('住戶', () => {
  it('沒選過就是目前的隊伍；最多五隻', () => {
    const s = base();
    expect(homeResidents(s)).toEqual(s.team.slice(0, HOME_MAX));
  });

  it('點一下住進來、再點一下搬出去；滿五隻不能再加；沒有的角色不能住', () => {
    let s = { ...base(), team: [] as string[] };
    const ids = s.owned.slice(0, 5);
    expect(ids).toHaveLength(5);
    for (const id of ids) {
      const r = toggleResident(s, id);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.state;
    }
    expect(homeResidents(s)).toEqual(ids);
    const more = { ...s, owned: [...s.owned, 'liuxing'] };
    expect(toggleResident(more, 'liuxing')).toEqual({ ok: false, error: 'full' });
    expect(toggleResident(s, 'nobody')).toEqual({ ok: false, error: 'not-owned' });
    const out = toggleResident(s, ids[0]);
    expect(out.ok && homeResidents(out.state)).toEqual(ids.slice(1));
  });

  it('住戶後來不在了（不再擁有）就不算', () => {
    const s = base();
    const r = toggleResident({ ...s, team: [] }, s.owned[0]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(homeResidents({ ...r.state, owned: [] })).toEqual([]);
  });
});

describe('擺家具', () => {
  it('擺出來、收起來、搬位置、全部收起來', () => {
    let s = base();
    expect(homePlaced(s, 'dog').some((p) => p.item.id === 'tv')).toBe(false);
    s = toggleFurniture(s, 'dog', 'tv');
    expect(homePlaced(s, 'dog', 'indoor').some((p) => p.item.id === 'tv')).toBe(true);
    // 原本預設擺著的還在
    expect(homePlaced(s, 'dog').some((p) => p.item.id === 'pool')).toBe(true);
    s = moveFurniture(s, 'dog', 'tv', { x: 0.25, y: 2 });
    expect(homePlaced(s, 'dog').find((p) => p.item.id === 'tv')!.spot).toEqual({ x: 0.25, y: 1 });
    // 沒擺出來的搬不動
    expect(moveFurniture(s, 'dog', 'clock', { x: 0.5, y: 0.5 })).toBe(s);
    s = toggleFurniture(s, 'dog', 'tv');
    expect(homePlaced(s, 'dog').some((p) => p.item.id === 'tv')).toBe(false);
    s = clearFurniture(s, 'dog', 'yard');
    expect(homePlaced(s, 'dog', 'yard')).toEqual([]);
    expect(homePlaced(s, 'dog', 'indoor').length).toBeGreaterThan(0);
    expect(toggleFurniture(s, 'dog', 'nope')).toBe(s);
  });

  it('換場景、換風格', () => {
    let s = base();
    expect(s.home.area).toBe('indoor');
    s = setHomeArea(s, 'yard');
    expect(s.home.area).toBe('yard');
    expect(setHomeArea(s, 'yard')).toBe(s);
    s = setHomeStyle(s, 'beach');
    expect(s.home.style).toBe('beach');
    expect(setHomeStyle(s, 'nope').home.style).toBe(HOME_STYLES[0].id);
  });
});

describe('讀檔檢查', () => {
  it('壞掉的資料回到預設；只留認得的角色與家具，位置夾在 0～1', () => {
    const def = { residents: null, placed: null, area: 'indoor', style: 'meadow' };
    expect(sanitizeHome(undefined, () => true)).toEqual(def);
    expect(sanitizeHome('x', () => true)).toEqual(def);
    const got = sanitizeHome(
      {
        residents: ['a', 'a', 'b', 7, 'gone', 'c', 'd', 'e', 'f'],
        placed: { tv: { x: 5, y: -1 }, nope: { x: 0, y: 0 }, sofa: { x: 'a', y: 0 }, rug: 3 },
        area: 'yard',
        style: 'candy',
      },
      (id) => id !== 'gone',
    );
    expect(got).toEqual({
      residents: ['a', 'b', 'c', 'd', 'e'],
      placed: { tv: { x: 1, y: 0 } },
      area: 'yard',
      style: 'candy',
    });
  });
});

describe('版面', () => {
  const l = homeLayout(844, 390);
  it('按鈕都在標題列裡、不重疊；場地在地平線下面', () => {
    const bs = Object.values(l.buttons).sort((a, b) => a.x - b.x);
    for (const [i, b] of bs.entries()) {
      expect(b.x).toBeGreaterThan(480);
      expect(b.x + b.width).toBeLessThanOrEqual(844);
      expect(b.y + b.height).toBeLessThanOrEqual(56);
      if (i > 0) expect(b.x).toBeGreaterThanOrEqual(bs[i - 1].x + bs[i - 1].width);
    }
    expect(l.field.y).toBeGreaterThan(l.horizon);
    expect(l.field.y + l.field.height).toBeLessThanOrEqual(390);
  });

  it('位置換算來回一致，超出場地就貼邊', () => {
    const spot = { x: 0.3, y: 0.7 };
    const p = xyOf(l, spot);
    const back = spotOf(l, p.x, p.y);
    expect(back.x).toBeCloseTo(0.3, 2);
    expect(back.y).toBeCloseTo(0.7, 2);
    expect(spotOf(l, -100, 9999)).toEqual({ x: 0, y: 1 });
  });

  it('彈出視窗的格子夠放 25 件家具、15 種風格，不重疊也不超出視窗', () => {
    const box = { x: 62, y: 34, width: 720, height: 322 };
    for (const [cols, rows] of [
      [5, 5],
      [5, 3],
      [10, 3],
    ] as const) {
      const cells = homeModalGrid(box, cols, rows);
      expect(cells).toHaveLength(cols * rows);
      for (const c of cells) {
        expect(c.x).toBeGreaterThanOrEqual(box.x);
        expect(c.x + c.width).toBeLessThanOrEqual(box.x + box.width);
        expect(c.y + c.height).toBeLessThanOrEqual(box.y + box.height - 44);
        expect(c.height).toBeGreaterThanOrEqual(36);
      }
      expect(cells[1].x).toBeGreaterThanOrEqual(cells[0].x + cells[0].width);
      expect(cells[cols].y).toBeGreaterThanOrEqual(cells[0].y + cells[0].height);
    }
  });
});
