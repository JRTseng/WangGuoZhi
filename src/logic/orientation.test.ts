import { describe, expect, it } from 'vitest';
import { gameSizeFor, orientationFor } from './orientation';

describe('orientation', () => {
  it('寬大於高才算橫放', () => {
    expect(orientationFor(390, 844)).toBe('portrait');
    expect(orientationFor(844, 390)).toBe('landscape');
    expect(orientationFor(500, 500)).toBe('portrait');
  });
  it('橫式尺寸是直式寬高對調', () => {
    expect(gameSizeFor('portrait')).toEqual({ width: 390, height: 844 });
    expect(gameSizeFor('landscape')).toEqual({ width: 844, height: 390 });
  });
});
