import type { Rect } from './layout';

/**
 * 圖鑑畫面（T038）的排版，只做橫式（遊戲固定橫向）：
 * 左邊一欄是分頁、收集進度、收集獎勵與「領取獎勵」，右邊是格子，一頁放得下 50 隻角色、不用捲。
 * T043 起分頁變四顆（汪國／喵國／裝備／背景）排成兩列；裝備 66 種排十一欄，背景 12 張排四欄。
 */
export interface CodexLayout {
  tabs: Rect[];
  /** 「收集 12／50」那行 */
  count: { x: number; y: number };
  /** 各稀有度收集幾隻那行 */
  rarity: { x: number; y: number };
  /** 收集獎勵一行一段 */
  milestones: { x: number; y: number }[];
  claim: Rect;
  /** 角色格子，由左到右、由上到下 */
  cells: Rect[];
}

export const CODEX_COLUMNS = 10;
/** 背景頁（T043）一列放幾張 */
export const CODEX_BACKGROUND_COLUMNS = 4;
/** 分頁一列放幾顆（T043：分頁變四顆，排成兩列） */
export const CODEX_TABS_PER_ROW = 2;
/** 格子至少要這麼大，手指才點得到 */
const MIN_CELL = 44;

const MARGIN = 12;
const SIDE_WIDTH = 136;
const TAB_HEIGHT = 44;
const GAP = 6;

/**
 * 一頁要放 cellCount 格、不捲動，至少要幾欄：從十欄開始，列數多到格子太矮就再加一欄。
 * 50 個角色是十欄五列，66 種裝備是十一欄六列。
 */
export function codexColumnsFor(cellCount: number, h: number, top = 56): number {
  const space = h - (top + 8) - MARGIN;
  let columns = CODEX_COLUMNS;
  for (;;) {
    const rows = Math.max(1, Math.ceil(cellCount / columns));
    if (Math.floor((space - GAP * (rows - 1)) / rows) >= MIN_CELL || columns >= 16) return columns;
    columns += 1;
  }
}

export function codexLayout(
  w: number,
  h: number,
  top = 56,
  cellCount = 50,
  tabCount = 2,
  milestoneCount = 5,
  columns = CODEX_COLUMNS,
): CodexLayout {
  const y0 = top + 8;
  const perRow = Math.min(tabCount, CODEX_TABS_PER_ROW);
  const tabRows = Math.ceil(tabCount / perRow);
  const tabW = Math.floor((SIDE_WIDTH - GAP * (perRow - 1)) / perRow);
  const tabs: Rect[] = Array.from({ length: tabCount }, (_, i) => ({
    x: MARGIN + (i % perRow) * (tabW + GAP),
    y: y0 + Math.floor(i / perRow) * (TAB_HEIGHT + GAP),
    width: tabW,
    height: TAB_HEIGHT,
  }));
  const claim: Rect = {
    x: MARGIN,
    y: h - MARGIN - TAB_HEIGHT,
    width: SIDE_WIDTH,
    height: TAB_HEIGHT,
  };
  const countY = y0 + tabRows * TAB_HEIGHT + (tabRows - 1) * GAP + 10;
  const rarityY = countY + 24;
  // 稀有度那段有兩行
  const listTop = rarityY + 36;
  const step = Math.min(22, Math.floor((claim.y - 6 - listTop) / milestoneCount));
  const milestones = Array.from({ length: milestoneCount }, (_, i) => ({
    x: MARGIN + 2,
    y: listTop + i * step,
  }));

  const left = MARGIN + SIDE_WIDTH + MARGIN;
  const rows = Math.max(1, Math.ceil(cellCount / columns));
  const cellW = Math.floor((w - left - MARGIN - GAP * (columns - 1)) / columns);
  const cellH = Math.floor((h - y0 - MARGIN - GAP * (rows - 1)) / rows);
  const cells: Rect[] = Array.from({ length: cellCount }, (_, i) => ({
    x: left + (i % columns) * (cellW + GAP),
    y: y0 + Math.floor(i / columns) * (cellH + GAP),
    width: cellW,
    height: cellH,
  }));
  return {
    tabs,
    count: { x: MARGIN + 2, y: countY },
    rarity: { x: MARGIN + 2, y: rarityY },
    milestones,
    claim,
    cells,
  };
}
