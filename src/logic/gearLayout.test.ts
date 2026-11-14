import { describe, expect, it } from 'vitest';
import { GEAR_TAB_COUNT, gearCard, gearLayout, gearScrollMax } from './gearLayout';
import type { Rect } from './layout';

const W = 844;
const H = 390;
const l = gearLayout(W, H, 56);
const inside = (r: Rect, box: Rect = { x: 0, y: 56, width: W, height: H - 56 }) =>
  r.x >= box.x &&
  r.y >= box.y &&
  r.x + r.width <= box.x + box.width + 0.01 &&
  r.y + r.height <= box.y + box.height + 0.01;
const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('倉庫版面', () => {
  it('所有東西都在畫面裡，左右兩邊不重疊', () => {
    for (const r of [l.pane, l.prev, l.next, l.list, ...l.slots, ...l.tabs]) {
      expect(inside(r)).toBe(true);
    }
    expect(overlap(l.pane, l.list)).toBe(false);
    for (const t of l.tabs) expect(overlap(l.pane, t)).toBe(false);
    expect(l.auto.x + l.auto.width).toBeLessThanOrEqual(W);
    expect(l.auto.y + l.auto.height).toBeLessThanOrEqual(56);
  });

  it('五個裝備格在狗狗卡裡排成一列、夠大好按，狗狗站在格子上面', () => {
    expect(l.slots).toHaveLength(5);
    for (const [i, s] of l.slots.entries()) {
      expect(inside(s, l.pane)).toBe(true);
      expect(s.width).toBeGreaterThanOrEqual(44);
      if (i > 0) expect(s.x).toBeGreaterThan(l.slots[i - 1].x + l.slots[i - 1].width);
    }
    expect(l.dog.y).toBeLessThan(l.slots[0].y);
    expect(inside(l.prev, l.pane) && inside(l.next, l.pane)).toBe(true);
  });

  it('六個分頁不重疊、夠寬；清單兩欄，一頁看得到四列', () => {
    expect(l.tabs).toHaveLength(GEAR_TAB_COUNT);
    for (let i = 1; i < l.tabs.length; i++) expect(overlap(l.tabs[i - 1], l.tabs[i])).toBe(false);
    expect(l.tabs[0].width).toBeGreaterThanOrEqual(70);
    expect(l.tabs[0].y + l.tabs[0].height).toBeLessThanOrEqual(l.list.y);
    expect(l.cols).toBe(2);
    expect(inside(gearCard(l, 0), l.list)).toBe(true);
    expect(inside(gearCard(l, 7), l.list)).toBe(true);
    expect(overlap(gearCard(l, 0), gearCard(l, 1))).toBe(false);
    expect(overlap(gearCard(l, 0), gearCard(l, 2))).toBe(false);
  });

  it('八張以內不用捲，多了才能捲', () => {
    expect(gearScrollMax(l, 0)).toBe(0);
    expect(gearScrollMax(l, 8)).toBe(0);
    expect(gearScrollMax(l, 9)).toBe(l.cardH + l.gap);
    expect(gearScrollMax(l, 21)).toBe(7 * (l.cardH + l.gap));
  });
});
