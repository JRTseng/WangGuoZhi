import { describe, expect, it } from 'vitest';
import { homeCardLayout, homeLayout, petAt, petBox } from './homeLayout';
import { MIN_TAP } from './layout';

const W = 844;
const H = 390;

describe('我的家：摸摸與送零食的版面（T044）', () => {
  it('角色可以點的範圍以腳為底往上，再小的角色也有 44', () => {
    const big = petBox(400, 300, 0.6);
    expect(big).toEqual({ x: 400 - 36, y: 300 - 90, width: 72, height: 90 });
    const tiny = petBox(400, 300, 0.2);
    expect(tiny.width).toBe(MIN_TAP);
    expect(tiny.height).toBe(MIN_TAP);
    expect(tiny.y + tiny.height).toBe(300);
  });

  it('重疊時點到站在前面的那一隻；沒點到是 -1', () => {
    const back = petBox(400, 280, 0.5);
    const front = petBox(410, 300, 0.5);
    expect(petAt([back, front], 405, 270)).toBe(1);
    expect(petAt([front, back], 405, 270)).toBe(0);
    // 只有後面那隻的頭露出來的地方
    expect(petAt([back, front], 372, 210)).toBe(0);
    expect(petAt([back, front], 100, 100)).toBe(-1);
    expect(petAt([], 100, 100)).toBe(-1);
  });

  it('互動卡在畫面最下面、不超出畫面，按鈕都有 44 而且不重疊', () => {
    const c = homeCardLayout(W, H);
    expect(c.box.x).toBeGreaterThanOrEqual(0);
    expect(c.box.x + c.box.width).toBeLessThanOrEqual(W);
    expect(c.box.y + c.box.height).toBeLessThanOrEqual(H);
    // 不蓋到標題列與牆腳以上
    expect(c.box.y).toBeGreaterThan(homeLayout(W, H).horizon);
    expect(c.gifts).toHaveLength(3);
    const all = [...c.gifts, c.close];
    all.forEach((r, i) => {
      expect(r.width).toBeGreaterThanOrEqual(MIN_TAP);
      expect(r.height).toBeGreaterThanOrEqual(MIN_TAP);
      expect(r.x).toBeGreaterThanOrEqual(c.box.x);
      expect(r.x + r.width).toBeLessThanOrEqual(c.box.x + c.box.width);
      if (i > 0) expect(r.x).toBeGreaterThanOrEqual(all[i - 1].x + all[i - 1].width);
    });
    expect(c.info.x).toBeLessThan(c.gifts[0].x);
  });
});
