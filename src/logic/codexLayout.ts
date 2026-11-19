import type { Rect } from './layout';

/**
 * 圖鑑畫面（T038）的排版，只做橫式（遊戲固定橫向）：
 * 左邊一欄是陣營分頁、收集進度、收集獎勵與「領取獎勵」，右邊是角色格子，一頁放得下 50 隻、不用捲。
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

const MARGIN = 12;
const SIDE_WIDTH = 136;
const TAB_HEIGHT = 44;
const GAP = 6;

export function codexLayout(
  w: number,
  h: number,
  top = 56,
  cellCount = 50,
  tabCount = 2,
  milestoneCount = 5,
): CodexLayout {
  const y0 = top + 8;
  const tabW = Math.floor((SIDE_WIDTH - GAP * (tabCount - 1)) / tabCount);
  const tabs: Rect[] = Array.from({ length: tabCount }, (_, i) => ({
    x: MARGIN + i * (tabW + GAP),
    y: y0,
    width: tabW,
    height: TAB_HEIGHT,
  }));
  const claim: Rect = {
    x: MARGIN,
    y: h - MARGIN - TAB_HEIGHT,
    width: SIDE_WIDTH,
    height: TAB_HEIGHT,
  };
  const countY = y0 + TAB_HEIGHT + 10;
  const rarityY = countY + 24;
  // 稀有度那段有兩行
  const listTop = rarityY + 36;
  const step = Math.min(22, Math.floor((claim.y - 6 - listTop) / milestoneCount));
  const milestones = Array.from({ length: milestoneCount }, (_, i) => ({
    x: MARGIN + 2,
    y: listTop + i * step,
  }));

  const left = MARGIN + SIDE_WIDTH + MARGIN;
  const rows = Math.max(1, Math.ceil(cellCount / CODEX_COLUMNS));
  const cellW = Math.floor((w - left - MARGIN - GAP * (CODEX_COLUMNS - 1)) / CODEX_COLUMNS);
  const cellH = Math.floor((h - y0 - MARGIN - GAP * (rows - 1)) / rows);
  const cells: Rect[] = Array.from({ length: cellCount }, (_, i) => ({
    x: left + (i % CODEX_COLUMNS) * (cellW + GAP),
    y: y0 + Math.floor(i / CODEX_COLUMNS) * (cellH + GAP),
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
