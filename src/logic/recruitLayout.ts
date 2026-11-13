import type { Rect } from './layout';

/**
 * 召募畫面（T007）的排版。
 * 直式：上面看板、中間結果、最下面兩顆按鈕（拇指好按）。
 * 橫式：左邊看板與按鈕、右邊結果。
 */
export interface RecruitLayout {
  /** 看板：標題、主打的狗、機率與保底說明 */
  banner: Rect;
  /** 抽到的結果顯示範圍 */
  results: Rect;
  /** 按鈕上方一行小字（中心點） */
  note: { x: number; y: number };
  buttons: { one: Rect; ten: Rect };
}

const MARGIN = 16;
const GAP = 10;

export function recruitLayout(w: number, h: number, landscape: boolean, top = 56): RecruitLayout {
  if (landscape) {
    const leftW = 300;
    const buttonH = 56;
    const by = h - 12 - buttonH;
    const bw = (leftW - GAP) / 2;
    const banner: Rect = { x: MARGIN, y: top + 8, width: leftW, height: by - 30 - (top + 8) };
    const rx = MARGIN + leftW + MARGIN;
    return {
      banner,
      results: { x: rx, y: top + 8, width: w - rx - MARGIN, height: h - top - 8 - 12 },
      note: { x: MARGIN + leftW / 2, y: by - 15 },
      buttons: {
        one: { x: MARGIN, y: by, width: bw, height: buttonH },
        ten: { x: MARGIN + bw + GAP, y: by, width: bw, height: buttonH },
      },
    };
  }
  const width = w - MARGIN * 2;
  const buttonH = 64;
  const by = h - 20 - buttonH;
  const bw = (width - GAP) / 2;
  const banner: Rect = { x: MARGIN, y: top + 10, width, height: 204 };
  const ry = banner.y + banner.height + GAP;
  return {
    banner,
    results: { x: MARGIN, y: ry, width, height: by - 34 - ry },
    note: { x: w / 2, y: by - 17 },
    buttons: {
      one: { x: MARGIN, y: by, width: bw, height: buttonH },
      ten: { x: MARGIN + bw + GAP, y: by, width: bw, height: buttonH },
    },
  };
}

/** 結果區最上面一行摘要占的高度 */
export const RESULT_SUMMARY_HEIGHT = 30;
const COLUMNS = 5;
const CELL_GAP = 6;

/**
 * 抽到的每一隻放在哪：1 隻是中間一張大卡；多隻是一列 5 張，放不下的換列，
 * 整塊在結果區（扣掉上面的摘要）裡置中。
 */
export function resultCells(l: RecruitLayout, count: number): Rect[] {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];
  const area: Rect = {
    x: l.results.x,
    y: l.results.y + RESULT_SUMMARY_HEIGHT,
    width: l.results.width,
    height: l.results.height - RESULT_SUMMARY_HEIGHT,
  };
  if (n === 1) {
    const width = Math.min(170, area.width);
    const height = Math.min(220, area.height);
    return [
      {
        x: area.x + (area.width - width) / 2,
        y: area.y + (area.height - height) / 2,
        width,
        height,
      },
    ];
  }
  const rows = Math.ceil(n / COLUMNS);
  const width = Math.floor((area.width - CELL_GAP * (COLUMNS - 1)) / COLUMNS);
  const height = Math.floor(Math.min(150, (area.height - CELL_GAP * (rows - 1)) / rows));
  const blockH = rows * height + (rows - 1) * CELL_GAP;
  const blockW = COLUMNS * width + (COLUMNS - 1) * CELL_GAP;
  const x0 = area.x + (area.width - blockW) / 2;
  const y0 = area.y + (area.height - blockH) / 2;
  return Array.from({ length: n }, (_, i) => ({
    x: x0 + (i % COLUMNS) * (width + CELL_GAP),
    y: y0 + Math.floor(i / COLUMNS) * (height + CELL_GAP),
    width,
    height,
  }));
}
