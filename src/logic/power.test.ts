import { describe, expect, it } from 'vitest';
import { DOGS } from '../data/dogs';
import { calcPower } from './power';

describe('calcPower', () => {
  it('1 級沒有等級加成', () => {
    expect(calcPower(40, 50, 1)).toBe(90);
  });

  it('每升一級加 10%', () => {
    expect(calcPower(40, 50, 3)).toBe(108);
    expect(calcPower(40, 50, 11)).toBe(180);
  });

  it('結果四捨五入為整數', () => {
    expect(calcPower(33, 0, 2)).toBe(36); // 36.3
    expect(calcPower(35, 0, 2)).toBe(39); // 38.5
  });

  it('不合理的輸入不會讓戰力變負或變小', () => {
    expect(calcPower(-10, 20, 1)).toBe(20);
    expect(calcPower(40, 50, 0)).toBe(90);
    expect(calcPower(40, 50, 2.9)).toBe(99);
  });

  it('等級越高戰力越高', () => {
    expect(calcPower(40, 50, 5)).toBeGreaterThan(calcPower(40, 50, 4));
  });

  it('5 隻初始角色都有正的戰力', () => {
    for (const d of DOGS) {
      expect(calcPower(d.baseAttack, d.baseDefense, d.level)).toBeGreaterThan(0);
    }
  });
});
