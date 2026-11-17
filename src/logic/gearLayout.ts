import type { Rect } from './layout';

/**
 * 倉庫畫面（T014）的版面，純計算。固定橫式 844 x 390：
 * 左邊一張卡是狗狗（左右箭頭換狗、全身像、五個裝備格＋兩個飾品格），右邊是部位分頁與裝備清單（兩欄、可上下捲）。
 */
export interface GearLayout {
  /** 左邊狗狗那張卡 */
  pane: Rect;
  prev: Rect;
  next: Rect;
  /** 狗狗腳底的位置與縮放 */
  dog: { x: number; y: number; scale: number };
  /** 七個裝備格，順序同 GEAR_SLOTS：下面一排五個部位，狗狗右邊直的兩格是飾品（T032） */
  slots: Rect[];
  /** 七個分頁：全部＋五個部位＋飾品 */
  tabs: Rect[];
  /** 清單可見範圍 */
  list: Rect;
  cols: number;
  cardW: number;
  cardH: number;
  gap: number;
  /** 標題列右邊的「一鍵穿上」 */
  auto: Rect;
  /** 「一鍵穿上」左邊的「全部升星」（T036） */
  starAll: Rect;
}

export const GEAR_TAB_COUNT = 7;
const SLOT_COUNT = 5;

export function gearLayout(w: number, h: number, bar: number): GearLayout {
  const m = 12;
  const pane: Rect = { x: m, y: bar + 8, width: 288, height: h - bar - 16 };
  const arrow = 40;
  const prev: Rect = { x: pane.x + 4, y: pane.y + 4, width: arrow, height: arrow };
  const next: Rect = { ...prev, x: pane.x + pane.width - 4 - arrow };
  const slot = 50;
  const slotGap = 7;
  const slotsW = slot * SLOT_COUNT + slotGap * (SLOT_COUNT - 1);
  const slotY = pane.y + pane.height - 22 - slot;
  const slotX = pane.x + (pane.width - slotsW) / 2;
  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => ({
    x: slotX + i * (slot + slotGap),
    y: slotY,
    width: slot,
    height: slot,
  }));
  // 飾品兩格：貼著卡片右邊，直的疊在五個部位上面
  const acc = 46;
  for (let i = 0; i < 2; i++) {
    slots.push({
      x: pane.x + pane.width - 8 - acc,
      y: slotY - (2 - i) * (acc + 16) - 6,
      width: acc,
      height: acc,
    });
  }
  const dog = { x: pane.x + pane.width / 2 - 30, y: slotY - 10, scale: 0.82 };

  const rx = pane.x + pane.width + m;
  const rw = w - m - rx;
  const tabGap = 5;
  const tabW = Math.floor((rw - tabGap * (GEAR_TAB_COUNT - 1)) / GEAR_TAB_COUNT);
  const tabs = Array.from({ length: GEAR_TAB_COUNT }, (_, i) => ({
    x: rx + i * (tabW + tabGap),
    y: pane.y,
    width: tabW,
    height: 30,
  }));
  const listY = pane.y + 38;
  const list: Rect = { x: rx, y: listY, width: rw, height: h - 8 - listY };
  const cols = 2;
  const gap = 8;
  return {
    pane,
    prev,
    next,
    dog,
    slots,
    tabs,
    list,
    cols,
    cardW: (rw - gap * (cols - 1)) / cols,
    cardH: 64,
    gap,
    auto: { x: w - 8 - 112, y: 6, width: 112, height: bar - 12 },
    starAll: { x: w - 8 - 112 - 8 - 124, y: 6, width: 124, height: bar - 12 },
  };
}

/** 清單第 i 張卡片的位置（還沒扣掉捲動量） */
export function gearCard(l: GearLayout, i: number): Rect {
  const col = i % l.cols;
  const row = Math.floor(i / l.cols);
  return {
    x: l.list.x + col * (l.cardW + l.gap),
    y: l.list.y + row * (l.cardH + l.gap),
    width: l.cardW,
    height: l.cardH,
  };
}

/** count 張卡片最多可以往下捲多少 */
export function gearScrollMax(l: GearLayout, count: number): number {
  const rows = Math.ceil(count / l.cols);
  const content = rows * l.cardH + Math.max(0, rows - 1) * l.gap;
  return Math.max(0, content - l.list.height);
}

/** 卡片左邊的圖示：點這裡開升星視窗（T036）。比畫出來的圖示大一點，手指好按 */
export function gearCardIcon(card: Rect): Rect {
  return { x: card.x, y: card.y, width: 60, height: card.height };
}

/** 升星視窗（T036）的大小，與裡面「升星」「關閉」兩顆按鈕的位置（box 是視窗的範圍） */
export const GEAR_STAR_PANEL = { width: 440, height: 250 };
export function gearStarPanelButtons(box: Rect): { up: Rect; close: Rect } {
  const y = box.y + box.height - 58;
  const gap = 16;
  const bw = 150;
  const x = box.x + (box.width - bw * 2 - gap) / 2;
  return {
    up: { x, y, width: bw, height: 44 },
    close: { x: x + bw + gap, y, width: bw, height: 44 },
  };
}
