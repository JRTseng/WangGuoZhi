import type { Rect } from './layout';

/**
 * 任務畫面（T011）的排版，只做橫式（遊戲固定橫向）：
 * 左邊一欄是分頁（主線／每日／成就）與「全部領取」，右邊兩欄任務卡，一頁最多 10 張、不用捲。
 */
export interface QuestLayout {
  tabs: Rect[];
  claimAll: Rect;
  /** 分頁標題下面那行說明（左上角） */
  hint: { x: number; y: number };
  /** 任務卡，由左到右、由上到下 */
  cards: Rect[];
  /** 卡片右邊的按鈕（相對於卡片左上角） */
  button: Rect;
}

export const QUEST_COLUMNS = 2;
export const QUEST_ROWS = 5;

const MARGIN = 12;
const TAB_WIDTH = 112;
const TAB_HEIGHT = 46;
const GAP = 8;

export function questLayout(w: number, h: number, top = 56, tabCount = 3): QuestLayout {
  const tabs: Rect[] = Array.from({ length: tabCount }, (_, i) => ({
    x: MARGIN,
    y: top + GAP + i * (TAB_HEIGHT + GAP),
    width: TAB_WIDTH,
    height: TAB_HEIGHT,
  }));
  const claimAll: Rect = {
    x: MARGIN,
    y: h - MARGIN - TAB_HEIGHT,
    width: TAB_WIDTH,
    height: TAB_HEIGHT,
  };
  const left = MARGIN + TAB_WIDTH + MARGIN;
  const hintHeight = 22;
  const listTop = top + GAP + hintHeight;
  const cardW = Math.floor((w - left - MARGIN - GAP * (QUEST_COLUMNS - 1)) / QUEST_COLUMNS);
  const cardH = Math.floor((h - listTop - MARGIN - GAP * (QUEST_ROWS - 1)) / QUEST_ROWS);
  const cards: Rect[] = [];
  for (let i = 0; i < QUEST_COLUMNS * QUEST_ROWS; i++) {
    cards.push({
      x: left + (i % QUEST_COLUMNS) * (cardW + GAP),
      y: listTop + Math.floor(i / QUEST_COLUMNS) * (cardH + GAP),
      width: cardW,
      height: cardH,
    });
  }
  const bw = 76;
  const bh = Math.min(40, cardH - 8);
  return {
    tabs,
    claimAll,
    hint: { x: left, y: top + GAP },
    cards,
    button: { x: cardW - bw - 8, y: Math.floor((cardH - bh) / 2), width: bw, height: bh },
  };
}
