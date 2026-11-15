import { describe, expect, it } from 'vitest';
import { bakeScaleFor, renderScaleFor, renderScaleFromSearch } from './resolution';

const phone = { dpr: 3, viewWidth: 844, viewHeight: 390, quality: 'high' as const };

describe('renderScaleFor', () => {
  it('手機橫放：照實體像素畫', () => {
    expect(renderScaleFor(phone)).toBe(3);
    expect(renderScaleFor({ ...phone, dpr: 2 })).toBe(2);
  });

  it('直拿開遊戲也算成橫放的大小', () => {
    expect(renderScaleFor({ ...phone, viewWidth: 390, viewHeight: 844 })).toBe(3);
  });

  it('畫質決定上限：低 1 倍、中 2 倍、高 3 倍', () => {
    expect(renderScaleFor({ ...phone, quality: 'low' })).toBe(1);
    expect(renderScaleFor({ ...phone, quality: 'medium' })).toBe(2);
    expect(renderScaleFor({ ...phone, dpr: 4 })).toBe(3);
  });

  it('小手機畫面被縮小，就不用畫那麼大', () => {
    // 667 x 375：畫面縮成 0.79 倍，2 倍螢幕只要 1.5 倍
    expect(renderScaleFor({ ...phone, dpr: 2, viewWidth: 667, viewHeight: 375 })).toBe(1.5);
  });

  it('電腦大螢幕：畫面被放大就跟著畫大張', () => {
    expect(renderScaleFor({ dpr: 1, viewWidth: 1688, viewHeight: 780, quality: 'high' })).toBe(2);
    expect(renderScaleFor({ dpr: 1, viewWidth: 844, viewHeight: 390, quality: 'high' })).toBe(1);
  });

  it('不會低於 1 倍，怪數字當 1', () => {
    expect(renderScaleFor({ ...phone, dpr: 0.5, viewWidth: 400, viewHeight: 200 })).toBe(1);
    expect(renderScaleFor({ ...phone, dpr: Number.NaN, viewWidth: 0, viewHeight: 0 })).toBe(1);
  });

  it('自動化測試固定 1 倍，網址指定的優先', () => {
    expect(renderScaleFor({ ...phone, automated: true })).toBe(1);
    expect(renderScaleFor({ ...phone, automated: true, override: 2 })).toBe(2);
    expect(renderScaleFor({ ...phone, quality: 'low', override: 2.4 })).toBe(2.5);
    expect(renderScaleFor({ ...phone, override: 99 })).toBe(4);
  });
});

describe('renderScaleFromSearch', () => {
  it('讀 ?res=', () => {
    expect(renderScaleFromSearch('?res=2')).toBe(2);
    expect(renderScaleFromSearch('?fast=1&res=1.5')).toBe(1.5);
    expect(renderScaleFromSearch('?fast=1')).toBeNull();
    expect(renderScaleFromSearch('?res=abc')).toBeNull();
    expect(renderScaleFromSearch('?res=0')).toBeNull();
    expect(renderScaleFromSearch('?res=')).toBeNull();
  });
});

describe('bakeScaleFor', () => {
  it('背景最多 2 倍', () => {
    expect(bakeScaleFor(1)).toBe(1);
    expect(bakeScaleFor(1.5)).toBe(1.5);
    expect(bakeScaleFor(3)).toBe(2);
  });
});
