import type { Rect } from './layout';

/**
 * 訓練場（T005）的排版：上方一行說明，下面是可捲動的狗狗列表。
 * 直式一欄、橫式兩欄；放不下就上下捲動。
 */
export interface TrainingLayout {
  /** 說明文字的位置（中心點） */
  hint: { x: number; y: number };
  /** 列表可見範圍 */
  list: Rect;
  columns: number;
  rowWidth: number;
  rowHeight: number;
  gap: number;
  /** 全部列排完的高度 */
  contentHeight: number;
  /** 最多可以往下捲多少 */
  scrollMax: number;
}

const MARGIN = 16;
const HINT_HEIGHT = 34;

export function trainingLayout(
  w: number,
  h: number,
  landscape: boolean,
  count: number,
  top = 56,
): TrainingLayout {
  const columns = landscape ? 2 : 1;
  const gap = 10;
  const rowHeight = landscape ? 92 : 104;
  const list: Rect = {
    x: MARGIN,
    y: top + HINT_HEIGHT,
    width: w - MARGIN * 2,
    height: h - top - HINT_HEIGHT - (landscape ? 8 : 16),
  };
  const rowWidth = (list.width - gap * (columns - 1)) / columns;
  const rows = Math.ceil(Math.max(0, count) / columns);
  const contentHeight = rows === 0 ? 0 : rows * rowHeight + (rows - 1) * gap;
  return {
    hint: { x: w / 2, y: top + HINT_HEIGHT / 2 },
    list,
    columns,
    rowWidth,
    rowHeight,
    gap,
    contentHeight,
    scrollMax: Math.max(0, contentHeight - list.height),
  };
}

/** 第 index 列的位置（還沒扣掉捲動量） */
export function trainingRow(l: TrainingLayout, index: number): Rect {
  const col = index % l.columns;
  const row = Math.floor(index / l.columns);
  return {
    x: l.list.x + col * (l.rowWidth + l.gap),
    y: l.list.y + row * (l.rowHeight + l.gap),
    width: l.rowWidth,
    height: l.rowHeight,
  };
}
