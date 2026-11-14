import type { Rect } from './layout';

/**
 * 選狗畫面的排版（T015），組隊編排與出征選狗共用。
 * - 直式：由上而下「標題列（右邊自動編隊）→ 3×3 陣型九宮格 → 定位篩選 → 狀態與排序 → 狗狗卡片格」
 * - 橫式：左邊一欄陣型九宮格，右邊「定位篩選 → 狀態、排序、自動編隊 → 狗狗卡片格」
 * 九宮格（2026-11-14 Jimmy）：直的三行由左到右是後排、中排、前排（前排在右邊面對敵人），
 * 每行上、中、下三格；從卡片格把狗拖上去就上陣並站那一格。
 * 卡片格固定大小，放不下時上下捲動。
 */
export interface PickerLayoutInput {
  w: number;
  h: number;
  landscape: boolean;
  /** 選狗區最上緣 */
  top: number;
  /** 卡片格最下緣 */
  bottom: number;
  /** 橫式：左欄九宮格最下緣（出征選狗要留位置給出發按鈕）；沒給就用 bottom */
  slotsBottom?: number;
  /** 定位篩選有幾顆（含「全部」） */
  roleCount: number;
  /** 狀態篩選有幾顆（含「全部」） */
  statusCount: number;
}

export interface PickerLayout {
  /** 標題文字的左上角 */
  title: { x: number; y: number; width: number };
  autoButton: Rect;
  /** 陣型九宮格整塊的範圍 */
  board: Rect;
  /** 九宮格三排（直行）各自的範圍，索引就是第幾排（0 前、1 中、2 後） */
  boardRows: Rect[];
  /** 九宮格的格子：boardCells[row][lane]（lane 0 上、1 中、2 下） */
  boardCells: Rect[][];
  /** 三排標題（前排／中排／後排）的中心點 */
  boardLabels: { x: number; y: number }[];
  /** 九宮格下面那一行提示文字的中心點 */
  boardHint: { x: number; y: number };
  roleChips: Rect[];
  statusChips: Rect[];
  sortChip: Rect;
  /** 卡片格可見範圍（捲動時裁切在這裡面） */
  grid: Rect;
  columns: number;
  cellHeight: number;
  gap: number;
}

const MARGIN = 16;
/** 橫式左欄寬 */
export const SIDE_WIDTH = 280;

function row(x: number, y: number, width: number, height: number, n: number, gap: number): Rect[] {
  const cw = Math.floor((width - gap * (n - 1)) / n);
  return Array.from({ length: n }, (_, i) => ({ x: x + i * (cw + gap), y, width: cw, height }));
}

/** 九宮格：area 是整塊可用的範圍（含標題與最下面一行提示） */
function boardLayout(
  area: Rect,
  colGap: number,
): Pick<PickerLayout, 'board' | 'boardRows' | 'boardCells' | 'boardLabels' | 'boardHint'> {
  const labelH = 18;
  const hintH = 18;
  const cellGap = 4;
  const colW = Math.floor((area.width - colGap * 2) / 3);
  const colH = area.height - hintH;
  const cellH = Math.floor((colH - labelH - cellGap * 2 - 4) / 3);
  const boardRows: Rect[] = [];
  const boardCells: Rect[][] = [];
  const boardLabels: { x: number; y: number }[] = [];
  for (let row = 0; row < 3; row++) {
    // 前排（0）在最右邊
    const x = area.x + (2 - row) * (colW + colGap);
    boardRows[row] = { x, y: area.y, width: colW, height: colH };
    boardLabels[row] = { x: x + colW / 2, y: area.y + labelH / 2 + 1 };
    boardCells[row] = [0, 1, 2].map((lane) => ({
      x: x + 3,
      y: area.y + labelH + lane * (cellH + cellGap),
      width: colW - 6,
      height: cellH,
    }));
  }
  return {
    board: area,
    boardRows,
    boardCells,
    boardLabels,
    boardHint: { x: area.x + area.width / 2, y: area.y + colH + hintH / 2 + 1 },
  };
}

export function layoutPicker(o: PickerLayoutInput): PickerLayout {
  const gap = 8;
  if (o.landscape) {
    const sideBottom = o.slotsBottom ?? o.bottom;
    const boardTop = o.top + 26;
    const board = boardLayout(
      { x: MARGIN, y: boardTop, width: SIDE_WIDTH, height: sideBottom - boardTop },
      4,
    );
    const x = MARGIN + SIDE_WIDTH + MARGIN;
    const width = o.w - x - MARGIN;
    const chipH = 36;
    const roleChips = row(x, o.top, width, chipH, o.roleCount, 4);
    const y2 = o.top + chipH + 6;
    const statusChips = row(
      x,
      y2,
      76 * o.statusCount + 4 * (o.statusCount - 1),
      chipH,
      o.statusCount,
      4,
    );
    const last = statusChips[statusChips.length - 1];
    const sortChip: Rect = { x: last.x + last.width + 12, y: y2, width: 116, height: chipH };
    const autoButton: Rect = { x: x + width - 124, y: y2, width: 124, height: chipH };
    const gridTop = y2 + chipH + 8;
    return {
      title: { x: MARGIN, y: o.top + 2, width: SIDE_WIDTH },
      autoButton,
      ...board,
      roleChips,
      statusChips,
      sortChip,
      grid: { x, y: gridTop, width, height: o.bottom - gridTop },
      columns: 4,
      cellHeight: 108,
      gap,
    };
  }

  const width = o.w - MARGIN * 2;
  const autoButton: Rect = { x: o.w - MARGIN - 112, y: o.top, width: 112, height: 40 };
  const boardTop = o.top + 46;
  const boardH = 196;
  const board = boardLayout({ x: MARGIN, y: boardTop, width, height: boardH }, 6);
  const chipH = 40;
  const y1 = boardTop + boardH + 6;
  const roleChips = row(MARGIN, y1, width, chipH, o.roleCount, 4);
  const y2 = y1 + chipH + 6;
  const statusChips = row(
    MARGIN,
    y2,
    76 * o.statusCount + 4 * (o.statusCount - 1),
    chipH,
    o.statusCount,
    4,
  );
  const sortChip: Rect = { x: o.w - MARGIN - 116, y: y2, width: 116, height: chipH };
  const gridTop = y2 + chipH + 8;
  return {
    title: { x: MARGIN, y: o.top + 9, width: width - 120 },
    autoButton,
    ...board,
    roleChips,
    statusChips,
    sortChip,
    grid: { x: MARGIN, y: gridTop, width, height: o.bottom - gridTop },
    columns: 3,
    cellHeight: 150,
    gap,
  };
}

/** 卡片格內容總高度 */
export function gridContentHeight(
  count: number,
  columns: number,
  cellHeight: number,
  gap: number,
): number {
  const rows = Math.ceil(Math.max(0, count) / Math.max(1, columns));
  return rows === 0 ? 0 : rows * cellHeight + (rows - 1) * gap;
}

/** 最多可以往下捲多少 */
export function maxScroll(contentHeight: number, viewHeight: number): number {
  return Math.max(0, Math.ceil(contentHeight - viewHeight));
}

export function clampScroll(scroll: number, max: number): number {
  return Math.min(Math.max(0, scroll), Math.max(0, max));
}

/** 第 i 張卡片在卡片格裡的位置（還沒扣捲動量） */
export function gridCell(
  i: number,
  l: Pick<PickerLayout, 'grid' | 'columns' | 'cellHeight' | 'gap'>,
): Rect {
  const cw = Math.floor((l.grid.width - l.gap * (l.columns - 1)) / l.columns);
  return {
    x: l.grid.x + (i % l.columns) * (cw + l.gap),
    y: l.grid.y + Math.floor(i / l.columns) * (l.cellHeight + l.gap),
    width: cw,
    height: l.cellHeight,
  };
}
