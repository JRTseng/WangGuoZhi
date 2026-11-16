import { describe, expect, it } from 'vitest';
import {
  DAY_TIMES,
  GRADES,
  MOODS,
  MOTES_BY_QUALITY,
  blurTaps,
  dayTimeFor,
  dayTimeFromSearch,
  moodAt,
  rayAngles,
  type MoodKey,
} from './atmosphere';

describe('dayTimeFor', () => {
  it('5～8 點清晨、8～16 點白天、16～19 點黃昏，其他是夜晚', () => {
    expect(dayTimeFor(5)).toBe('dawn');
    expect(dayTimeFor(7)).toBe('dawn');
    expect(dayTimeFor(8)).toBe('day');
    expect(dayTimeFor(15)).toBe('day');
    expect(dayTimeFor(16)).toBe('dusk');
    expect(dayTimeFor(18)).toBe('dusk');
    expect(dayTimeFor(19)).toBe('night');
    expect(dayTimeFor(0)).toBe('night');
    expect(dayTimeFor(4)).toBe('night');
  });

  it('超出 0～23 的數字也算得出來', () => {
    expect(dayTimeFor(24)).toBe('night');
    expect(dayTimeFor(30)).toBe('dawn');
    expect(dayTimeFor(-1)).toBe('night');
  });
});

describe('dayTimeFromSearch', () => {
  it('讀網址的 ?time=', () => {
    for (const t of DAY_TIMES) expect(dayTimeFromSearch(`?fast=1&time=${t}`)).toBe(t);
  });
  it('沒寫或寫錯回傳 null', () => {
    expect(dayTimeFromSearch('')).toBeNull();
    expect(dayTimeFromSearch('?time=')).toBeNull();
    expect(dayTimeFromSearch('?time=noon')).toBeNull();
  });
});

describe('moodAt', () => {
  const keys = Object.keys(MOODS) as MoodKey[];

  it('白天不改場景自己的氣氛', () => {
    for (const k of keys) expect(moodAt(k, 'day')).toEqual({ ...MOODS[k], tint: 0xffffff });
  });

  it('本來就是晚上的場景，什麼時段都一樣', () => {
    for (const k of keys.filter((x) => MOODS[x].dark)) {
      for (const t of DAY_TIMES) expect(moodAt(k, t)).toEqual(moodAt(k, 'day'));
    }
  });

  it('白天的場景到了黃昏、夜晚會染色，數值不會超出範圍', () => {
    for (const k of keys.filter((x) => !MOODS[x].dark)) {
      for (const t of ['dawn', 'dusk', 'night'] as const) {
        const m = moodAt(k, t);
        expect(m.tint).toBe(GRADES[t].tint);
        expect(m.rayAlpha).toBeLessThanOrEqual(0.4);
        expect(m.vignette).toBeLessThanOrEqual(0.7);
        expect(m.vignette).toBeGreaterThanOrEqual(MOODS[k].vignette);
      }
      expect(moodAt(k, 'night').rayAlpha).toBeLessThan(MOODS[k].rayAlpha);
    }
  });

  it('每個場景的設定都在合理範圍', () => {
    for (const k of keys) {
      const m = MOODS[k];
      expect(m.rays).toBeGreaterThanOrEqual(0);
      expect(m.rays).toBeLessThanOrEqual(6);
      expect(m.hazeAlpha).toBeLessThan(0.5);
      if (m.sun) {
        expect(m.sun.x).toBeGreaterThan(0);
        expect(m.sun.x).toBeLessThan(1);
      }
    }
  });
});

describe('rayAngles', () => {
  it('光源在右邊往左下灑、在左邊往右下灑', () => {
    const right = rayAngles(0.8, 5);
    const left = rayAngles(0.2, 5);
    expect(right).toHaveLength(5);
    const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    expect(avg(right)).toBeGreaterThan(0);
    expect(avg(left)).toBeLessThan(0);
    expect(avg(rayAngles(0.5, 4))).toBeCloseTo(0);
  });
  it('沒有光束就是空的；角度不會歪到變橫的', () => {
    expect(rayAngles(0.5, 0)).toEqual([]);
    for (const a of [...rayAngles(0.05, 6), ...rayAngles(0.95, 6)]) {
      expect(Math.abs(a)).toBeLessThan(70);
    }
  });
});

describe('blurTaps', () => {
  it('中間先畫、再往兩邊，透明度照順序是 1、1/2、1/3…（疊完是平均）', () => {
    expect(blurTaps(2)).toEqual([
      { offset: 0, alpha: 1 },
      { offset: 1, alpha: 1 / 2 },
      { offset: -1, alpha: 1 / 3 },
      { offset: 2, alpha: 1 / 4 },
      { offset: -2, alpha: 1 / 5 },
    ]);
  });
  it('半徑 0 就不模糊', () => {
    expect(blurTaps(0)).toEqual([{ offset: 0, alpha: 1 }]);
    expect(blurTaps(-3)).toHaveLength(1);
  });
});

describe('MOTES_BY_QUALITY', () => {
  it('低畫質沒有光點，畫質越高越多', () => {
    expect(MOTES_BY_QUALITY.low).toBe(0);
    expect(MOTES_BY_QUALITY.high).toBeGreaterThan(MOTES_BY_QUALITY.medium);
  });
});
