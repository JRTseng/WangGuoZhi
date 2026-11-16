import type { Rect } from './layout';

/**
 * 簽到畫面（T026）的排版，只做橫式（遊戲固定橫向）：
 * 上面一行說明，中間七張獎勵卡排成一列，下面左邊是累計天數、中間「簽到領取」、右邊是倒數。
 */
export interface SigninLayout {
  /** 說明文字（置中） */
  hint: { x: number; y: number };
  /** 七張獎勵卡，由左到右 */
  cards: Rect[];
  claim: Rect;
  /** 左下「累計簽到 N 天」 */
  total: { x: number; y: number };
  /** 右下倒數（靠右對齊） */
  countdown: { x: number; y: number };
}

const MARGIN = 12;
const GAP = 8;
const HINT_HEIGHT = 26;
const CLAIM_HEIGHT = 48;
const CLAIM_WIDTH = 220;

export function signinLayout(w: number, h: number, top = 56, count = 7): SigninLayout {
  const cardsTop = top + GAP + HINT_HEIGHT;
  const claimY = h - MARGIN - CLAIM_HEIGHT;
  const cardW = Math.floor((w - MARGIN * 2 - GAP * (count - 1)) / count);
  const cardH = claimY - GAP - cardsTop;
  const left = Math.floor((w - (cardW * count + GAP * (count - 1))) / 2);
  const cards: Rect[] = Array.from({ length: count }, (_, i) => ({
    x: left + i * (cardW + GAP),
    y: cardsTop,
    width: cardW,
    height: cardH,
  }));
  const mid = claimY + CLAIM_HEIGHT / 2;
  return {
    hint: { x: w / 2, y: top + GAP + HINT_HEIGHT / 2 },
    cards,
    claim: {
      x: Math.floor((w - CLAIM_WIDTH) / 2),
      y: claimY,
      width: CLAIM_WIDTH,
      height: CLAIM_HEIGHT,
    },
    total: { x: left, y: mid },
    countdown: { x: w - left, y: mid },
  };
}

/** 第 7 天選 SSR 狗的彈出框：上面標題，下面一格一隻狗 */
export interface SigninPickLayout {
  /** 彈出框的大小（置中） */
  size: { width: number; height: number };
  /** 每隻狗一格，位置是相對彈出框左上角 */
  cells: Rect[];
  cols: number;
  /** 標題的位置（相對彈出框左上角，置中） */
  title: { x: number; y: number };
  /** 右上角的關閉鈕（相對彈出框左上角） */
  close: Rect;
}

const PICK_PAD = 14;
const PICK_TITLE = 44;
const PICK_GAP = 8;

/** count 隻狗排成 2 列（超過 14 隻排 3 列以上），格子照畫面大小縮放 */
export function signinPickLayout(w: number, h: number, count: number): SigninPickLayout {
  const n = Math.max(1, count);
  const cols = Math.min(7, Math.max(4, Math.ceil(n / 2)));
  const rows = Math.ceil(n / cols);
  const maxW = w - 32;
  const maxH = h - 24;
  const cellW = Math.min(104, Math.floor((maxW - PICK_PAD * 2 - PICK_GAP * (cols - 1)) / cols));
  const cellH = Math.min(
    128,
    Math.floor((maxH - PICK_TITLE - PICK_PAD - PICK_GAP * (rows - 1)) / rows),
  );
  const width = PICK_PAD * 2 + cellW * cols + PICK_GAP * (cols - 1);
  const height = PICK_TITLE + PICK_PAD + cellH * rows + PICK_GAP * (rows - 1);
  const cells: Rect[] = Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / cols);
    // 最後一列沒排滿就置中
    const inRow = row === rows - 1 ? n - row * cols : cols;
    const offset = ((cols - inRow) * (cellW + PICK_GAP)) / 2;
    return {
      x: PICK_PAD + offset + (i % cols) * (cellW + PICK_GAP),
      y: PICK_TITLE + row * (cellH + PICK_GAP),
      width: cellW,
      height: cellH,
    };
  });
  return {
    size: { width, height },
    cells,
    cols,
    title: { x: width / 2, y: PICK_TITLE / 2 },
    close: { x: width - 44 - 4, y: 0, width: 44, height: 44 },
  };
}
