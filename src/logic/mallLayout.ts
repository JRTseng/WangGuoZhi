import type { Rect } from './layout';

/**
 * 商城畫面（T039）的排版，只做橫式（遊戲固定橫向）：
 * 標題列下面一行說明（幾點換新、身上有多少錢），再下面是三欄兩列共六張商品卡，一頁放完不用捲。
 */
export interface MallCardLayout {
  card: Rect;
  /** 左上的圖示框 */
  icon: Rect;
  /** 圖示右邊的文字從哪裡開始、最寬多少 */
  text: { x: number; y: number; width: number };
  /** 底下的購買按鈕 */
  buy: Rect;
}

export interface MallLayout {
  /** 說明那一行的位置（左邊是換新時間，右邊靠 right 對齊寫糧草與骨頭幣） */
  note: { x: number; y: number; right: number };
  cards: MallCardLayout[];
}

export const MALL_COLUMNS = 3;

const MARGIN = 12;
const GAP = 8;
const NOTE_HEIGHT = 24;
const PAD = 10;
const ICON = 52;
const BUY_HEIGHT = 44;

export function mallLayout(w: number, h: number, top = 56, count = 6): MallLayout {
  const noteY = top + 6;
  const y0 = noteY + NOTE_HEIGHT;
  const rows = Math.max(1, Math.ceil(count / MALL_COLUMNS));
  const cardW = Math.floor((w - MARGIN * 2 - GAP * (MALL_COLUMNS - 1)) / MALL_COLUMNS);
  const cardH = Math.floor((h - y0 - MARGIN - GAP * (rows - 1)) / rows);
  const cards: MallCardLayout[] = Array.from({ length: count }, (_, i) => {
    const card: Rect = {
      x: MARGIN + (i % MALL_COLUMNS) * (cardW + GAP),
      y: y0 + Math.floor(i / MALL_COLUMNS) * (cardH + GAP),
      width: cardW,
      height: cardH,
    };
    return {
      card,
      icon: { x: card.x + PAD, y: card.y + PAD, width: ICON, height: ICON },
      text: { x: card.x + PAD + ICON + 10, y: card.y + PAD, width: cardW - PAD * 2 - ICON - 10 },
      buy: {
        x: card.x + PAD,
        y: card.y + cardH - PAD - BUY_HEIGHT,
        width: cardW - PAD * 2,
        height: BUY_HEIGHT,
      },
    };
  });
  return { note: { x: MARGIN + 2, y: noteY, right: w - MARGIN - 2 }, cards };
}
