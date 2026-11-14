import { describe, expect, it } from 'vitest';
import { DOGS } from '../data/dogs';
import { ROW_MAX } from './battle';
import {
  arrangeCells,
  arrangeRows,
  battleRoleOf,
  defaultRowOfDog,
  resetFormation,
  cellValue,
  savedLaneOf,
  savedRowOf,
  setDogCell,
  setDogRow,
  teamCells,
  teamRows,
} from './formation';

const st = (formation: Record<string, number> = {}) => ({ formation });

describe('陣型', () => {
  it('每隻狗都有定位；預設站位：守護、突擊前排，補給中排，謀略、幸運、補血後排', () => {
    for (const d of DOGS) expect(battleRoleOf(d.role), d.name).toBeDefined();
    expect(defaultRowOfDog('changxu')).toBe(0);
    expect(defaultRowOfDog('heixuan')).toBe(0);
    expect(defaultRowOfDog('daer')).toBe(1);
    expect(defaultRowOfDog('xiaosuan')).toBe(2);
    expect(defaultRowOfDog('abai')).toBe(2);
    expect(defaultRowOfDog('nuantong')).toBe(2);
    expect(defaultRowOfDog('不存在')).toBe(0);
  });

  it('沒存過陣型（舊存檔）就照定位排', () => {
    expect(teamRows(st(), ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'])).toEqual([
      1, 0, 0, 2, 2,
    ]);
    expect(teamRows(st(), [])).toEqual([]);
  });

  it('一排最多 3 隻：超過的擠到最近還有空位的一排', () => {
    // 四隻謀略：前三隻後排，第四隻擠到中排
    const mages = ['xiaosuan', 'shuangyan', 'zhuifeng', 'xueling'];
    expect(arrangeRows(mages)).toEqual([2, 2, 2, 1]);
    // 五隻前排定位：三隻前排，兩隻中排
    const front = ['heixuan', 'changxu', 'tieya', 'modian', 'jiying'];
    expect(arrangeRows(front)).toEqual([0, 0, 0, 1, 1]);
    for (const rows of [arrangeRows(mages), arrangeRows(front)]) {
      for (const r of [0, 1, 2])
        expect(rows.filter((x) => x === r).length).toBeLessThanOrEqual(ROW_MAX);
    }
    // 存檔裡的排不是 0～2 就當成沒存
    expect(arrangeRows(['daer'], { daer: 7 })).toEqual([1]);
  });

  it('換排：記下整隊的站位；那一排滿了、不在隊伍裡、沒變，都原樣回傳', () => {
    const team = ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'];
    const a = st();
    const b = setDogRow(a, team, 'daer', 0);
    expect(teamRows(b, team)).toEqual([0, 0, 0, 2, 2]);
    // 記的是九宮格的格子：大耳補進前排中間的空格
    expect(b.formation).toEqual({
      daer: cellValue(0, 1),
      heixuan: cellValue(0, 0),
      changxu: cellValue(0, 2),
      xiaosuan: cellValue(2, 0),
      abai: cellValue(2, 2),
    });
    expect(a.formation).toEqual({});
    // 前排已經 3 隻
    expect(setDogRow(b, team, 'xiaosuan', 0)).toBe(b);
    expect(setDogRow(b, team, 'daer', 0)).toBe(b);
    expect(setDogRow(b, team, 'tieya', 1)).toBe(b);
    const c = setDogRow(b, team, 'abai', 1);
    expect(teamRows(c, team)).toEqual([0, 0, 0, 2, 1]);
  });

  it('九宮格：一排一隻站中間、兩隻站上下、三隻站滿；一格只站一隻', () => {
    const team = ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'];
    expect(arrangeCells(team)).toEqual([
      { row: 1, lane: 1 },
      { row: 0, lane: 0 },
      { row: 0, lane: 2 },
      { row: 2, lane: 0 },
      { row: 2, lane: 2 },
    ]);
    expect(arrangeCells(['heixuan', 'changxu', 'tieya']).map((c) => c.lane)).toEqual([0, 1, 2]);
    // 舊存檔只記排（0～2）：排照舊，格子照預設補
    expect(arrangeCells(team, { daer: 0, abai: 1 })).toEqual([
      { row: 0, lane: 0 },
      { row: 0, lane: 1 },
      { row: 0, lane: 2 },
      { row: 2, lane: 1 },
      { row: 1, lane: 1 },
    ]);
    // 不管存檔記了什麼，同一格不會站兩隻
    const clash = arrangeCells(team, {
      daer: cellValue(0, 1),
      heixuan: cellValue(0, 1),
      changxu: cellValue(0, 1),
      xiaosuan: cellValue(0, 1),
      abai: 99,
    });
    expect(new Set(clash.map((c) => c.row * 3 + c.lane)).size).toBe(team.length);
    expect(clash[0]).toEqual({ row: 0, lane: 1 });
    expect([savedRowOf(2), savedLaneOf(2)]).toEqual([2, undefined]);
    expect([savedRowOf(cellValue(2, 0)), savedLaneOf(cellValue(2, 0))]).toEqual([2, 0]);
    for (const bad of [-1, 12, 1.5, '1', null]) expect(savedRowOf(bad)).toBeUndefined();
  });

  it('移到某一格：空格就移過去，有隊友就對調；整隊的格子都記下來', () => {
    const team = ['daer', 'heixuan', 'changxu'];
    const a = st();
    // 長鬚（前排下）移到後排上
    const b = setDogCell(a, team, 'changxu', 2, 0);
    expect(teamCells(b, team)).toEqual([
      { row: 1, lane: 1 },
      { row: 0, lane: 0 },
      { row: 2, lane: 0 },
    ]);
    expect(a.formation).toEqual({});
    // 大耳移到黑旋那一格：兩隻對調
    const c = setDogCell(b, team, 'daer', 0, 0);
    expect(teamCells(c, team)).toEqual([
      { row: 0, lane: 0 },
      { row: 1, lane: 1 },
      { row: 2, lane: 0 },
    ]);
    // 同一排換格子
    const d = setDogCell(c, team, 'daer', 0, 2);
    expect(teamCells(d, team)[0]).toEqual({ row: 0, lane: 2 });
    // 沒變、不在隊伍裡：原樣回傳
    expect(setDogCell(d, team, 'daer', 0, 2)).toBe(d);
    expect(setDogCell(d, team, 'tieya', 1, 0)).toBe(d);
    // 換隊友後記下來的格子還在
    expect(teamCells(d, ['daer', 'abai'])[0]).toEqual({ row: 0, lane: 2 });
  });

  it('照定位重排：清掉這幾隻記下來的站位，別隻不動', () => {
    const a = st({ daer: 0, heixuan: 2, tieya: 1 });
    const b = resetFormation(a, ['daer', 'heixuan']);
    expect(b.formation).toEqual({ tieya: 1 });
    expect(resetFormation(b, ['daer', 'heixuan'])).toBe(b);
  });
});
