import { describe, expect, it } from 'vitest';
import { formatAmount } from './format';

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
