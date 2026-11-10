import { describe, expect, it } from 'vitest';
import { formatVersion } from './version';

describe('formatVersion', () => {
  it('版本號加上 git hash', () => {
    expect(formatVersion('0.1.0', 'a1b2c3d')).toBe('v0.1.0+a1b2c3d');
  });

  it('沒有 hash 時只顯示版本號', () => {
    expect(formatVersion('0.1.0')).toBe('v0.1.0');
    expect(formatVersion('0.1.0', null)).toBe('v0.1.0');
    expect(formatVersion('0.1.0', '  ')).toBe('v0.1.0');
  });

  it('版本號為空時退回 0.0.0', () => {
    expect(formatVersion('', 'abc1234')).toBe('v0.0.0+abc1234');
  });
});
