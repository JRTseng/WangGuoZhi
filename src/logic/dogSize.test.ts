import { describe, expect, it } from 'vitest';
import { DOGS } from '../data/dogs';
import { bodyScale, headScale } from './dogSize';

describe('狗的體型', () => {
  it('小型比中型小，大型比中型大', () => {
    expect(bodyScale('小型')).toBeLessThan(bodyScale('中型'));
    expect(bodyScale('大型')).toBeGreaterThan(bodyScale('中型'));
    expect(headScale('小型')).toBeLessThan(headScale('中型'));
    expect(headScale('大型')).toBeGreaterThan(headScale('中型'));
  });

  it('中型與沒寫體型的不縮放', () => {
    expect(bodyScale('中型')).toBe(1);
    expect(bodyScale(undefined)).toBe(1);
    expect(headScale(undefined)).toBe(1);
  });

  it('戰鬥頭像的差距比全身小', () => {
    expect(headScale('大型')).toBeLessThan(bodyScale('大型'));
    expect(headScale('小型')).toBeGreaterThan(bodyScale('小型'));
  });

  it('每隻狗都有體型', () => {
    for (const d of DOGS) expect(d.size, d.id).toBeDefined();
  });
});
