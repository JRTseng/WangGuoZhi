import { describe, expect, it } from 'vitest';
import { trainingLayout, trainingRow } from './trainingLayout';

describe('trainingLayout', () => {
  it('直式一欄：5 隻不用捲動，都在畫面內', () => {
    const l = trainingLayout(390, 844, false, 5);
    expect(l.columns).toBe(1);
    expect(l.scrollMax).toBe(0);
    for (let i = 0; i < 5; i++) {
      const r = trainingRow(l, i);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(390);
      expect(r.y + r.height).toBeLessThanOrEqual(844);
      if (i > 0) expect(r.y).toBeGreaterThan(trainingRow(l, i - 1).y);
    }
  });

  it('橫式兩欄：左右並排、不重疊', () => {
    const l = trainingLayout(844, 390, true, 5);
    expect(l.columns).toBe(2);
    const a = trainingRow(l, 0);
    const b = trainingRow(l, 1);
    expect(b.y).toBe(a.y);
    expect(b.x).toBeGreaterThanOrEqual(a.x + a.width);
    expect(b.x + b.width).toBeLessThanOrEqual(844);
    expect(trainingRow(l, 2).y).toBeGreaterThanOrEqual(a.y + a.height);
  });

  it('狗多了放不下就可以捲動，捲到底剛好看到最後一列', () => {
    const l = trainingLayout(390, 844, false, 18);
    expect(l.scrollMax).toBeGreaterThan(0);
    const last = trainingRow(l, 17);
    expect(last.y + last.height - l.scrollMax).toBeCloseTo(l.list.y + l.list.height);
  });

  it('沒有狗也不會出錯', () => {
    const l = trainingLayout(390, 844, false, 0);
    expect(l.contentHeight).toBe(0);
    expect(l.scrollMax).toBe(0);
  });
});
