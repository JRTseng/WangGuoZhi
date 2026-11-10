import { describe, expect, it } from 'vitest';
import { FAST_MINUTE_MS, MINUTE_MS, minuteMsFromSearch } from './timeScale';

describe('minuteMsFromSearch', () => {
  it('預設 1 分鐘 = 60 秒', () => {
    expect(minuteMsFromSearch('')).toBe(MINUTE_MS);
    expect(minuteMsFromSearch('?stay=boot')).toBe(MINUTE_MS);
  });
  it('?fast=1 時 1 分鐘 = 1 秒', () => {
    expect(minuteMsFromSearch('?fast=1')).toBe(FAST_MINUTE_MS);
    expect(minuteMsFromSearch('?stay=boot&fast=true')).toBe(FAST_MINUTE_MS);
  });
});
