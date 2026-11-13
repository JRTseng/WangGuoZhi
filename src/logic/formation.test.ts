import { describe, expect, it } from 'vitest';
import { DOGS } from '../data/dogs';
import { ROW_MAX } from './battle';
import {
  arrangeRows,
  battleRoleOf,
  defaultRowOfDog,
  resetFormation,
  setDogRow,
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
    expect(b.formation).toEqual({ daer: 0, heixuan: 0, changxu: 0, xiaosuan: 2, abai: 2 });
    expect(a.formation).toEqual({});
    // 前排已經 3 隻
    expect(setDogRow(b, team, 'xiaosuan', 0)).toBe(b);
    expect(setDogRow(b, team, 'daer', 0)).toBe(b);
    expect(setDogRow(b, team, 'tieya', 1)).toBe(b);
    const c = setDogRow(b, team, 'abai', 1);
    expect(teamRows(c, team)).toEqual([0, 0, 0, 2, 1]);
  });

  it('照定位重排：清掉這幾隻記下來的站位，別隻不動', () => {
    const a = st({ daer: 0, heixuan: 2, tieya: 1 });
    const b = resetFormation(a, ['daer', 'heixuan']);
    expect(b.formation).toEqual({ tieya: 1 });
    expect(resetFormation(b, ['daer', 'heixuan'])).toBe(b);
  });
});
