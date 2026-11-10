import { describe, expect, it } from 'vitest';
import { REGIONS, findStage } from './regions';

describe('regions', () => {
  it('第一版 1 個地區 3 個關卡，耗時 5 / 10 / 20 分鐘', () => {
    expect(REGIONS).toHaveLength(1);
    expect(REGIONS[0].name).toBe('落葉坡');
    expect(REGIONS[0].stages.map((s) => s.durationMin)).toEqual([5, 10, 20]);
  });
  it('關卡 id 不重複，獎勵為正', () => {
    const ids = REGIONS.flatMap((r) => r.stages.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of REGIONS[0].stages) {
      expect(s.reward.food).toBeGreaterThan(0);
      expect(s.reward.bones).toBeGreaterThan(0);
    }
  });
  it('findStage 找得到與找不到', () => {
    expect(findStage('luoyepo-2')?.name).toBe('紅葉林');
    expect(findStage('nope')).toBeUndefined();
  });
});
