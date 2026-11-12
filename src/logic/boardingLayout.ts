import { BOARDING_MAX_SLOTS } from './boarding';
import type { Rect } from './layout';

/**
 * 板凳寄宿畫面（T021）的排版：一行說明、寄宿位、下面是可捲動的狗狗名單。
 * 直式：寄宿位一列一個、名單一欄；橫式：寄宿位三個並排、名單兩欄。
 */
export interface BoardingLayout {
  /** 說明文字的位置（中心點） */
  hint: { x: number; y: number };
  /** 全部的寄宿位（含還沒開放的），固定不捲動 */
  slots: Rect[];
  /** 名單標題的位置（左上角） */
  listTitle: { x: number; y: number };
  /** 名單可見範圍 */
  list: Rect;
  columns: number;
  rowWidth: number;
  rowHeight: number;
  gap: number;
  /** 按鈕（接回、寄宿）的大小 */
  buttonWidth: number;
  buttonHeight: number;
  contentHeight: number;
  /** 最多可以往下捲多少 */
  scrollMax: number;
}

const MARGIN = 16;

export function boardingLayout(
  w: number,
  h: number,
  landscape: boolean,
  count: number,
  top = 56,
): BoardingLayout {
  const gap = 8;
  const hintHeight = landscape ? 28 : 34;
  const slotHeight = landscape ? 68 : 76;
  const titleHeight = landscape ? 24 : 30;
  const width = w - MARGIN * 2;
  const slotsTop = top + hintHeight;
  const slotColumns = landscape ? BOARDING_MAX_SLOTS : 1;
  const slotWidth = (width - gap * (slotColumns - 1)) / slotColumns;
  const slots: Rect[] = [];
  for (let i = 0; i < BOARDING_MAX_SLOTS; i++) {
    slots.push({
      x: MARGIN + (i % slotColumns) * (slotWidth + gap),
      y: slotsTop + Math.floor(i / slotColumns) * (slotHeight + gap),
      width: slotWidth,
      height: slotHeight,
    });
  }
  const slotRows = Math.ceil(BOARDING_MAX_SLOTS / slotColumns);
  const slotsBottom = slotsTop + slotRows * slotHeight + (slotRows - 1) * gap;

  const columns = landscape ? 2 : 1;
  const rowHeight = landscape ? 58 : 64;
  const listY = slotsBottom + titleHeight;
  const list: Rect = {
    x: MARGIN,
    y: listY,
    width,
    height: h - listY - (landscape ? 8 : 16),
  };
  const rowWidth = (width - gap * (columns - 1)) / columns;
  const rows = Math.ceil(Math.max(0, count) / columns);
  const contentHeight = rows === 0 ? 0 : rows * rowHeight + (rows - 1) * gap;
  return {
    hint: { x: w / 2, y: top + hintHeight / 2 },
    slots,
    listTitle: { x: MARGIN + 2, y: slotsBottom + (landscape ? 4 : 8) },
    list,
    columns,
    rowWidth,
    rowHeight,
    gap,
    buttonWidth: landscape ? 72 : 92,
    buttonHeight: landscape ? 40 : 44,
    contentHeight,
    scrollMax: Math.max(0, contentHeight - list.height),
  };
}

/** 名單第 index 列的位置（還沒扣掉捲動量） */
export function boardingRow(l: BoardingLayout, index: number): Rect {
  const col = index % l.columns;
  const row = Math.floor(index / l.columns);
  return {
    x: l.list.x + col * (l.rowWidth + l.gap),
    y: l.list.y + row * (l.rowHeight + l.gap),
    width: l.rowWidth,
    height: l.rowHeight,
  };
}

const BUTTON_PAD = 10;

/** 一張卡片（寄宿位或名單列）右邊的按鈕：垂直置中 */
export function boardingButton(l: BoardingLayout, card: Rect): Rect {
  return {
    x: card.x + card.width - BUTTON_PAD - l.buttonWidth,
    y: card.y + (card.height - l.buttonHeight) / 2,
    width: l.buttonWidth,
    height: l.buttonHeight,
  };
}
