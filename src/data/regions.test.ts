import { describe, expect, it } from 'vitest';
import { REGIONS, findRegionOfStage, findStage } from './regions';

describe('regions', () => {
  it('3 個章節，每章 5 小節', () => {
    expect(REGIONS.map((r) => r.chapter)).toEqual([1, 2, 3]);
    for (const r of REGIONS) expect(r.stages).toHaveLength(5);
  });
  it('落葉坡前 3 關沿用 5 / 10 / 20 分鐘', () => {
    expect(REGIONS[0].name).toBe('落葉坡');
    expect(REGIONS[0].stages.slice(0, 3).map((s) => s.durationMin)).toEqual([5, 10, 20]);
  });
  it('每章只有最後一關是 Boss', () => {
    for (const r of REGIONS) {
      expect(r.stages.map((s) => !!s.boss)).toEqual([false, false, false, false, true]);
    }
    expect(REGIONS.map((r) => r.stages[4].boss!.breed)).toEqual(['高山犬', '大丹犬', '藏獒']);
  });
  it('關卡 id 不重複，獎勵為正', () => {
    const ids = REGIONS.flatMap((r) => r.stages.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of REGIONS.flatMap((r) => r.stages)) {
      expect(s.reward.food).toBeGreaterThan(0);
      expect(s.reward.bones).toBeGreaterThan(0);
    }
  });
  it('findStage / findRegionOfStage', () => {
    expect(findStage('luoyepo-2')?.name).toBe('紅葉林');
    expect(findStage('nope')).toBeUndefined();
    expect(findRegionOfStage('zhulindu-3')?.chapter).toBe(2);
    expect(findRegionOfStage('nope')).toBeUndefined();
  });
});
