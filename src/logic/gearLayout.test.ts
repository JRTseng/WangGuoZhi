import { describe, expect, it } from 'vitest';
import {
  GEAR_STAR_PANEL,
  GEAR_TAB_COUNT,
  gearCard,
  gearCardIcon,
  gearLayout,
  gearScrollMax,
  gearStarPanelButtons,
} from './gearLayout';
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
    expect(l.slots).toHaveLength(7);
    for (const [i, s] of l.slots.slice(0, 5).entries()) {
      expect(inside(s, l.pane)).toBe(true);
      expect(s.width).toBeGreaterThanOrEqual(44);
      if (i > 0) expect(s.x).toBeGreaterThan(l.slots[i - 1].x + l.slots[i - 1].width);
    }
    expect(l.dog.y).toBeLessThan(l.slots[0].y);
    expect(inside(l.prev, l.pane) && inside(l.next, l.pane)).toBe(true);
  });

  it('飾品兩格直的疊在卡片右邊，不壓到下面那一排、也不壓到換狗的箭頭', () => {
    const [neck, ear] = l.slots.slice(5);
    for (const s of [neck, ear]) {
      expect(inside(s, l.pane)).toBe(true);
      expect(s.width).toBeGreaterThanOrEqual(44);
      expect(overlap(s, l.next)).toBe(false);
      for (const base of l.slots.slice(0, 5)) expect(overlap(s, base)).toBe(false);
    }
    expect(neck.y + neck.height).toBeLessThan(ear.y);
    // 格子下面還有一行部位名稱
    expect(ear.y + ear.height + 14).toBeLessThanOrEqual(l.slots[0].y);
  });

  it('七個分頁不重疊、夠寬；清單兩欄，一頁看得到四列', () => {
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

  it('全部升星在標題列裡、不蓋到一鍵穿上與返回、也不蓋到中間的標題', () => {
    expect(l.starAll.y + l.starAll.height).toBeLessThanOrEqual(56);
    expect(overlap(l.starAll, l.auto)).toBe(false);
    expect(l.starAll.x).toBeGreaterThan(W / 2 + 40);
    expect(l.starAll.height).toBeGreaterThanOrEqual(44);
  });

  it('卡片的圖示範圍在卡片左邊、夠大好按', () => {
    const card = gearCard(l, 3);
    const icon = gearCardIcon(card);
    expect(inside(icon, card)).toBe(true);
    expect(icon.width).toBeGreaterThanOrEqual(44);
    expect(icon.height).toBeGreaterThanOrEqual(44);
    expect(icon.width).toBeLessThan(card.width / 2);
  });

  it('升星視窗的兩顆按鈕在視窗裡、不重疊、夠大', () => {
    const box: Rect = {
      x: (W - GEAR_STAR_PANEL.width) / 2,
      y: (H - GEAR_STAR_PANEL.height) / 2,
      ...GEAR_STAR_PANEL,
    };
    expect(inside(box, { x: 0, y: 0, width: W, height: H })).toBe(true);
    const b = gearStarPanelButtons(box);
    expect(inside(b.up, box)).toBe(true);
    expect(inside(b.close, box)).toBe(true);
    expect(overlap(b.up, b.close)).toBe(false);
    for (const r of [b.up, b.close]) expect(r.height).toBeGreaterThanOrEqual(44);
  });
});
