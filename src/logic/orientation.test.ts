import { describe, expect, it } from 'vitest';
import { gameSizeFor, orientationFor, shouldRotate, unrotatePoint } from './orientation';

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
  it('觸控裝置直拿才把畫面轉 90 度', () => {
    expect(shouldRotate(390, 844, true)).toBe(true);
    expect(shouldRotate(844, 390, true)).toBe(false);
    expect(shouldRotate(390, 844, false)).toBe(false);
  });
  it('轉 90 度以後手指的位置換回遊戲的方向：螢幕右上角是遊戲的左上角', () => {
    expect(unrotatePoint(390, 0, 390)).toEqual({ x: 0, y: 0 });
    // 螢幕右下角是遊戲的右上角，螢幕左上角是遊戲的左下角
    expect(unrotatePoint(390, 844, 390)).toEqual({ x: 844, y: 0 });
    expect(unrotatePoint(0, 0, 390)).toEqual({ x: 0, y: 390 });
    expect(unrotatePoint(195, 422, 390)).toEqual({ x: 422, y: 195 });
  });
});
