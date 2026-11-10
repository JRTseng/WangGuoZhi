import { describe, expect, it } from 'vitest';
import { formatAmount, formatCountdown } from './format';

describe('formatAmount', () => {
  it('加千分位', () => {
    expect(formatAmount(1200)).toBe('1,200');
    expect(formatAmount(50)).toBe('50');
    expect(formatAmount(1234567)).toBe('1,234,567');
  });
  it('小數無條件捨去', () => {
    expect(formatAmount(99.9)).toBe('99');
  });
});

describe('formatCountdown', () => {
  it('未滿 1 小時顯示 mm:ss', () => {
    expect(formatCountdown(5 * 60_000)).toBe('05:00');
    expect(formatCountdown(61_000)).toBe('01:01');
  });
  it('滿 1 小時顯示 h:mm:ss', () => {
    expect(formatCountdown(3_600_000 + 5_000)).toBe('1:00:05');
  });
  it('不足 1 秒進位，0 以下顯示 00:00', () => {
    expect(formatCountdown(1)).toBe('00:01');
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-500)).toBe('00:00');
  });
});
