import { describe, expect, it } from 'vitest';
import { DOGS } from '../data/dogs';
import { calcPower } from './power';

describe('calcPower', () => {
  it('戰力 = 攻擊 + 防禦，沒有等級修正', () => {
    expect(calcPower(40, 50)).toBe(90);
    expect(calcPower(64, 30)).toBe(94);
  });

  it('結果四捨五入為整數', () => {
    expect(calcPower(33.4, 0)).toBe(33);
    expect(calcPower(33.5, 0)).toBe(34);
  });

  it('不合理的輸入不會讓戰力變負', () => {
    expect(calcPower(-10, 20)).toBe(20);
    expect(calcPower(-5, -5)).toBe(0);
  });

  it('所有角色的基礎戰力都是正的', () => {
    for (const d of DOGS) expect(calcPower(d.baseAttack, d.baseDefense)).toBeGreaterThan(0);
  });
});
