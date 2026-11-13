import type { Rect } from './layout';

/**
 * 訓練場（T005、T020）的排版：上方一行說明，下面是可捲動的狗狗列表，
 * 每張卡片底部有攻擊特訓、防禦特訓、升星（T007）三顆按鈕。
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
  /** 特訓按鈕（T020）在卡片裡的位置：離卡片頂端多遠、多高 */
  buttonTop: number;
  buttonHeight: number;
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
  const rowHeight = landscape ? 130 : 138;
  const buttonHeight = landscape ? 36 : 40;
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
    buttonTop: rowHeight - buttonHeight - 6,
    buttonHeight,
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

const BUTTON_PAD = 14;
const BUTTON_GAP = 8;

/**
 * 第 index 列的三顆按鈕（還沒扣掉捲動量）：攻擊特訓、防禦特訓，最右邊比較窄的是升星（T007）。
 */
export function trainingButtons(
  l: TrainingLayout,
  index: number,
): { attack: Rect; defense: Rect; star: Rect } {
  const r = trainingRow(l, index);
  const starWidth = l.columns > 1 ? 90 : 74;
  const width = (r.width - BUTTON_PAD * 2 - BUTTON_GAP * 2 - starWidth) / 2;
  const y = r.y + l.buttonTop;
  const x = r.x + BUTTON_PAD;
  return {
    attack: { x, y, width, height: l.buttonHeight },
    defense: { x: x + width + BUTTON_GAP, y, width, height: l.buttonHeight },
    star: { x: x + (width + BUTTON_GAP) * 2, y, width: starWidth, height: l.buttonHeight },
  };
}

/**
 * 第 index 列右側的「改台詞」小按鈕（T017，還沒扣掉捲動量）：
 * 在卡片第二行靠右，戰力數字下面、經驗文字上面。
 */
export function trainingLineButton(l: TrainingLayout, index: number): Rect {
  const r = trainingRow(l, index);
  return { x: r.x + r.width - BUTTON_PAD - 76, y: r.y + 29, width: 76, height: 26 };
}
